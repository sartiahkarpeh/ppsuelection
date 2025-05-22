// src/app/api/admin/send-debate-link/route.ts
import { NextResponse }       from 'next/server';
import { prisma }             from '@/lib/prisma';
import jwt                    from 'jsonwebtoken';
import { cookies }            from 'next/headers';
import nodemailer             from 'nodemailer';

const JWT_SECRET = process.env.JWT_SECRET!;
const ZOOM_LINK  = process.env.ZOOM_LINK!; // e.g. https://zoom.us/…

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT!),
  secure: false,
  auth:   {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
  },
});

export const dynamic = 'force-dynamic';

export async function POST() {
  // — auth guard —
  const token = cookies().get('admin_token');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { jwt.verify(token.value, JWT_SECRET); }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }); }

  // 1) fetch all *registered* voters (or verified, up to you)
  const voters = await prisma.voter.findMany({
    select: { email: true, fullName: true },
  });

  let success = 0;
  let failed  = 0;
  const errors: { email: string; message: string }[] = [];

  // 2) send one at a time
  for (const v of voters) {
    try {
      await transporter.sendMail({
        from:    `"IEC Voting" <${process.env.SMTP_USER}>`,
        to:      v.email,
        subject: 'Live Debate Link',
        text: `
Hello ${v.fullName},

Please join our online debate scheduled for May 23, 2025 from 2pm onwards.:
${ZOOM_LINK}

See you online!

— IEC Voting Team
        `.trim(),
      });
      success++;
    } catch (err: any) {
      console.error(`Failed sending to ${v.email}:`, err);
      failed++;
      errors.push({ email: v.email, message: err.message });
    }

    // tiny pause so you don’t hit rate-limits
    await new Promise((r) => setTimeout(r, 200));
  }

  return NextResponse.json({
    message:      `Debate link sent to ${success} voters, ${failed} failed.`,
    failures:     errors,
  });
}


