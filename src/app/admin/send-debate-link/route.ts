// src/app/api/admin/send-debate-link/route.ts
import { NextResponse } from 'next/server';
import { prisma }      from '@/lib/prisma';
import nodemailer      from 'nodemailer';
import jwt             from 'jsonwebtoken';
import { cookies }     from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET!;
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

export async function POST(req: Request) {
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

  // parse the Zoom link
  let body: { zoomLink: string };
  try {
    body = await req.json();
    if (!body.zoomLink) throw new Error();
  } catch {
    return NextResponse.json({ error: 'Missing Zoom link.' }, { status: 400 });
  }

  // fetch all verified voters
  const voters = await prisma.voter.findMany({
    where: { verification: { verified: true } },
    select: { email: true, fullName: true },
  });

  // send one email per voter
  await Promise.all(voters.map(v => {
    return transporter.sendMail({
      from:    `"IEC Voting" <${process.env.SMTP_USER!}>`,
      to:      v.email,
      subject: 'Join the Online Candidate Debate',
      text: `
Hello ${v.fullName},

Our in-person debate was cancelled. Please join us online:

👉 ${body.zoomLink}

Thank you,
IEC Voting Team
      `,
    });
  }));

  return NextResponse.json({ message: 'Debate link sent.' });
}

