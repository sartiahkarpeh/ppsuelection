// src/app/api/admin/send-debate-link/route.ts
import { NextResponse }       from 'next/server';
import { prisma }             from '@/lib/prisma';
import jwt                    from 'jsonwebtoken';
import { cookies }            from 'next/headers';
import nodemailer             from 'nodemailer';

export const runtime = 'nodejs';        // <— ensure Node.js environment
export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET!;
const ZOOM_LINK  = process.env.ZOOM_LINK!;

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT!),
  secure: false,
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
  },
});

// verify SMTP credentials on cold start
transporter
  .verify()
  .then(() => console.log('SMTP server is ready'))
  .catch((err) => {
    console.error('SMTP configuration error:', err);
    // Depending on your preference, you could throw here
  });

export async function POST() {
  // — auth guard —
  const token = cookies().get('admin_token');
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    jwt.verify(token.value, JWT_SECRET);
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // 1) fetch all registered voters
  const voters = await prisma.voter.findMany({
    select: { email: true, fullName: true },
  });

  let success = 0;
  let failed  = 0;
  const errors: { email: string; message: string }[] = [];

  // 2) send in series (or consider batching if you hit timeouts)
  for (const v of voters) {
    try {
      await transporter.sendMail({
        from:    `"IEC Voting" <${process.env.SMTP_USER}>`,
        to:      v.email,
        subject: 'Live Debate Link',
        text: `
Hello ${v.fullName},

Please join our online debate scheduled for May 23, 2025 from 2 pm onwards:
${ZOOM_LINK}

— IEC Voting Team
        `.trim(),
      });
      success++;
    } catch (err: any) {
      console.error(`Failed sending to ${v.email}:`, err);
      failed++;
      errors.push({ email: v.email, message: err.message });
    }
    // pause to avoid rate limits (tweak as needed)
    await new Promise((r) => setTimeout(r, 200));
  }

  // choose 207 Multi-Status if you want non-2xx on partial failure
  return NextResponse.json(
    {
      message:  `Debate link sent to ${success} voters, ${failed} failed.`,
      failures: errors,
    },
    { status: failed === voters.length ? 502 : 200 }
  );
}

