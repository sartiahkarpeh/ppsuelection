// src/app/api/admin/candidates/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || !body.name || !body.position) {
    return NextResponse.json({ error: 'Missing name or position.' }, { status: 400 });
  }
  const { name, party, position } = body;

  try {
    // find or create the position by title
    let pos = await prisma.position.findUnique({ where: { title: position } });
    if (!pos) {
      pos = await prisma.position.create({ data: { title: position } });
    }
    // create candidate
    const cand = await prisma.candidate.create({
      data: {
        name,
        party,
        positionId: pos.id,
        photoUrl: '', // start blank
      },
    });
    return NextResponse.json(cand, { status: 201 });
  } catch (e: any) {
    console.error('Add candidate error:', e);
    return NextResponse.json({ error: 'Failed to add candidate.' }, { status: 500 });
  }
}

