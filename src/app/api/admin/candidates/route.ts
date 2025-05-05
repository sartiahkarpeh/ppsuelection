// src/app/api/admin/candidates/route.ts
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

  // — fetch candidates —
  try {
    const candidates = await prisma.candidate.findMany({
      include: { position: { select: { title: true } } },
      orderBy: { name: 'asc' },
    });

    const data = candidates.map(c => ({
      id:       c.id,
      name:     c.name,
      party:    c.party,
      position: c.position.title,
      photoUrl: c.photoUrl,
    }));

    return NextResponse.json(data);
  } catch (e: any) {
    console.error('GET /api/admin/candidates error:', e);
    return NextResponse.json(
      { error: 'Failed to fetch candidates.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
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

  // — parse & validate body —
  const body = await req.json().catch(() => null);
  if (!body || !body.name || !body.position) {
    return NextResponse.json(
      { error: 'Missing name or position.' },
      { status: 400 }
    );
  }
  const { name, party, position } = body;

  try {
    // find or create the position by title
    let pos = await prisma.position.findFirst({ where: { title: position } });
    if (!pos) {
      pos = await prisma.position.create({ data: { title: position } });
    }
    // create candidate
    const cand = await prisma.candidate.create({
      data: {
        name,
        party,
        positionId: pos.id,
        photoUrl: '',
      },
    });
    return NextResponse.json(cand, { status: 201 });
  } catch (e: any) {
    console.error('POST /api/admin/candidates error:', e);
    return NextResponse.json(
      { error: 'Failed to add candidate.' },
      { status: 500 }
    );
  }
}

