// src/app/api/verify/email/route.ts
import { NextResponse } from 'next/server'
import { prisma }      from '@/lib/prisma'

export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const { voterId, code } = await request.json()

  if (!voterId || !code) {
    return NextResponse.json(
      { error: 'Missing voterId or code' },
      { status: 400 }
    )
  }

  // Look up by the *voterId* foreign key, not by the verification.id
  const rec = await prisma.verification.findUnique({
    where: { voterId }
  })

  if (!rec || rec.emailCode !== code) {
    return NextResponse.json(
      { error: 'Invalid code' },
      { status: 400 }
    )
  }

  // Mark it as verified
  await prisma.verification.update({
    where: { voterId },
    data:  { verified: true }
  })

  return NextResponse.json({ success: true })
}

