// src/app/api/admin/stats/route.ts
import { NextResponse } from 'next/server';
import { prisma }      from '@/lib/prisma';
import jwt             from 'jsonwebtoken';
import { cookies }     from 'next/headers';

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

  // — fetch stats —
  try {
    const totalVoters   = await prisma.voter.count();
    const totalVerified = await prisma.verification.count({ where: { verified: true } });
    const totalVotes    = await prisma.vote.count();

    return NextResponse.json({ totalVoters, totalVerified, totalVotes });
  } catch (e: any) {
    console.error('GET /api/admin/stats error:', e);
    return NextResponse.json(
      { error: 'Failed to fetch stats.' },
      { status: 500 }
    );
  }
}

