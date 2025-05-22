// src/app/api/admin/send-debate-link/route.ts
import { NextResponse }           from 'next/server';
import { prisma }                from '@/lib/prisma';
import nodemailer                from 'nodemailer';
import jwt                       from 'jsonwebtoken';
import { cookies }               from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET!;
const ZOOM_LINK  = process.env.ZOOM_LINK;    // ← Make sure this is set on Netlify!

if (!ZOOM_LINK) {
  console.error('❌ ZOOM_LINK env var not set!');
}

export const dynamic = 'force-dynamic';

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT),
  secure: false,
  auth:   { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
});

export async function POST(req: Request) {
  console.log('🟢 [send-debate-link] handler invoked');
  // — auth guard (using cookie + JWT) —
  const token = cookies().get('admin_token');
  if (!token) {
    console.warn('⚠️ No admin_token cookie');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    jwt.verify(token.value, JWT_SECRET);
  } catch (err) {
    console.warn('⚠️ Invalid JWT:', err);
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  if (!ZOOM_LINK) {
    return NextResponse.json({ error: 'Server misconfiguration: missing ZOOM_LINK' }, { status: 500 });
  }

  try {
    const voters = await prisma.voter.findMany({
      select: { email: true, fullName: true },
    });

    console.log(`📨 Sending debate link to ${voters.length} voters…`);
    await Promise.all(
      voters.map(v =>
        transporter.sendMail({
          from:    `"IEC Voting" <${process.env.SMTP_USER}>`,
          to:      v.email,
          subject: 'Join the Candidate Debate',
          text:    `Hello ${v.fullName},\n\nPlease join our online debate scheduled for May 23, 2025 from 2pm onwards:\n${ZOOM_LINK}\n\nSee you there!`,
        }).catch(e => {
          console.error(`Mail error for ${v.email}:`, e);
          // swallow per-voter errors so one failure doesn’t kill the whole batch
        })
      )
    );

    console.log('✅ Debate links sent.');
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('❌ [send-debate-link] failed:', e);
    return NextResponse.json({ error: 'Failed to send debate link' }, { status: 500 });
  }
}

