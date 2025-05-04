import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export async function GET() {
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

