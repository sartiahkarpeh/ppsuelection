import { NextResponse } from 'next/server'
import { prisma }      from '@/lib/prisma'
import { cookies }     from 'next/headers'
import jwt             from 'jsonwebtoken'
import nodemailer      from 'nodemailer'

const JWT_SECRET = process.env.JWT_SECRET!

// use your SMTP env vars here
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT),
  secure: false,
  auth:   {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!
  },
})

export async function POST(request: Request) {
  // — auth guard —
  const token = cookies().get('admin_token')
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    jwt.verify(token.value, JWT_SECRET)
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  // parse body
  let body: { zoomLink?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { zoomLink } = body
  if (!zoomLink) {
    return NextResponse.json({ error: 'Missing zoomLink' }, { status: 400 })
  }

  // fetch all verified voters
  const voters = await prisma.voter.findMany({
    where: { verification: { verified: true } },
    select: { fullName: true, email: true }
  })

  // send to each
  await Promise.all(voters.map(v =>
    transporter.sendMail({
      from:    `"IEC Voting" <${process.env.SMTP_USER}>`,
      to:      v.email,
      subject: 'Join the Online Candidate Debate',
      text: `
Hello ${v.fullName},

Please join us for the online candidate debate scheduled for May 23, 2025 from 2pm onwards:

${zoomLink}

Best regards,
IEC Voting Team
      `,
    })
  ))

  return NextResponse.json({ success: true })
}

