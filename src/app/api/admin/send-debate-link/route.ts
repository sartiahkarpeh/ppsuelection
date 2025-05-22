// src/app/api/admin/send-debate-link/route.ts
import { NextResponse } from 'next/server';
import { prisma }       from '@/lib/prisma';
import jwt              from 'jsonwebtoken';
import { cookies }      from 'next/headers';
import nodemailer       from 'nodemailer';
import pLimit           from 'p-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET!;
const ZOOM_LINK  = process.env.ZOOM_LINK!;

const transporter = nodemailer.createTransport({ /* … your SMTP config … */ });

// verify once at startup
transporter.verify().catch(err => {
  console.error('SMTP setup failed', err);
});

export async function POST() {
  const token = cookies().get('admin_token');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { jwt.verify(token.value, JWT_SECRET); }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }); }

  const voters = await prisma.voter.findMany({ select: { email: true, fullName: true } });

  const limit = pLimit(10); // at most 10 concurrent SMTP connections
  const results = await Promise.allSettled(
    voters.map(v =>
      limit(() =>
        transporter.sendMail({
          from: `"IEC Voting" <${process.env.SMTP_USER}>`,
          to:   v.email,
          subject: 'Live Debate Link',
          text: `Hello ${v.fullName},\n\nJoin our debate tomorrow at 2pm May 23, 2025:\n${ZOOM_LINK}\n\n—IEC Team`
        })
      )
    )
  );

  let success = 0;
  const failures: { email: string; message: string }[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') success++;
    else failures.push({ email: voters[i].email, message: r.reason.message });
  });

  const msg = `Debate link sent to ${success} of ${voters.length} voters.`;
  const code = success === 0 ? 502 : 200;
  return NextResponse.json({ message: msg, failures }, { status: code });
}

