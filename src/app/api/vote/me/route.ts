// src/app/api/vote/me/route.ts
import { NextResponse } from 'next/server'
import { prisma }      from '@/lib/prisma'
import jwt             from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET!

export async function GET(req: Request) {
  const token = req.cookies.get('token')?.value
  if (!token) {
    return NextResponse.json({ voted: false })
  }

  let payload: any
  try {
    payload = jwt.verify(token, JWT_SECRET)
  } catch {
    return NextResponse.json({ voted: false })
  }

  const vote = await prisma.vote.findUnique({
    where: { voterId: payload.voterId },
    include: { candidate: true }
  })
  if (!vote) {
    return NextResponse.json({ voted: false })
  }
  return NextResponse.json({
    voted:     true,
    candidate: vote.candidate
  })
}

