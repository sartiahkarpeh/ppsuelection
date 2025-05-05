// src/app/api/admin/voters/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET!;

export const dynamic = 'force-dynamic';

export async function GET() {
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

  // — fetch voters —
  try {
    const list = await prisma.voter.findMany({
      select: {
        id: true,
        fullName: true,
        universityId: true,
        email: true,
        verification: { select: { verified: true } },
      },
      orderBy: { fullName: 'asc' },
    });

    const voters = list.map(v => ({
      id: v.id,
      fullName: v.fullName,
      universityId: v.universityId,
      email: v.email,
      verified: v.verification?.verified ?? false,
    }));

    return NextResponse.json(voters);
  } catch (e: any) {
    console.error('GET /api/admin/voters error:', e);
    return NextResponse.json(
      { error: 'Failed to fetch voters.' },
      { status: 500 }
    );
  }
}

