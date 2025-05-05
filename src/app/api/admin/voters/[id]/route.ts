// src/app/api/admin/voters/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET!;

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
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

  // — perform delete (cascades verification & votes) —
  try {
    await prisma.voter.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(`DELETE /api/admin/voters/${params.id} error:`, e);
    return NextResponse.json(
      { error: 'Failed to delete voter.' },
      { status: 500 }
    );
  }
}

