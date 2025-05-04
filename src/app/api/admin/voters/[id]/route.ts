// src/app/api/admin/voters/[id]/route.ts
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server'
import { prisma }      from '@/lib/prisma'
import jwt             from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET!

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  // — auth guard —
  const token = cookies().get('admin_token');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try { jwt.verify(token.value, JWT_SECRET) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  // — perform delete (cascades verification & votes) —
  await prisma.voter.delete({
    where: { id: params.id }
  })

  return NextResponse.json({ success: true })
}

