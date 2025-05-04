// src/app/api/party/login/route.ts
import { NextResponse } from 'next/server'
import { prisma }      from '@/lib/prisma'
import jwt             from 'jsonwebtoken'

const SECRET = process.env.PARTY_JWT_SECRET!

export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const { email } = await request.json()
  if (!email) {
    return NextResponse.json({ error: 'Missing email' }, { status: 400 })
  }

  const rep = await prisma.partyRep.findUnique({
    where: { email: email.toLowerCase() }
  })
  if (!rep) {
    return NextResponse.json({ error: 'Unauthorized email' }, { status: 401 })
  }

  // Issue a simple JWT
  const token = jwt.sign(
    { repId: rep.id, email: rep.email },
    SECRET,
    { expiresIn: '8h' }
  )

  const res = NextResponse.json({ success: true })
  res.cookies.set('party_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  })
  return res
}

