// src/app/api/candidates/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const positions = await prisma.position.findMany({
    include: {
      candidates: {
        select: {
          id: true,
          name: true,
          photoUrl: true,
          party: true,
        },
      },
    },
    orderBy: { title: 'asc' },
  });

  return NextResponse.json(positions);
}

