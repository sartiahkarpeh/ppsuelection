import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
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

