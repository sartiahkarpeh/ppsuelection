import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;

// PATCH: update name, party, position (by title), photoUrl
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  // auth guard
  const token = req.cookies.get('admin_token');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    jwt.verify(token.value, JWT_SECRET);
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  let body: {
    photoUrl?: string;
    name?: string;
    party?: string | null;
    position?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const data: any = {};
  if (body.photoUrl) data.photoUrl = body.photoUrl;
  if (body.name) data.name = body.name;
  if (body.party !== undefined) data.party = body.party;

  // If updating position by title, upsert or connect
  if (body.position) {
    const pos = await prisma.position.upsert({
      where: { title: body.position },
      create: { title: body.position },
      update: {},
    });
    data.position = { connect: { id: pos.id } };
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }

  try {
    const updated = await prisma.candidate.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json({
      message: 'Candidate updated.',
      candidate: {
        id: updated.id,
        name: updated.name,
        party: updated.party,
        position: body.position ?? undefined,
        photoUrl: updated.photoUrl,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to update candidate.' }, { status: 500 });
  }
}

// DELETE: remove a candidate
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  // auth guard
  const token = req.cookies.get('admin_token');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    jwt.verify(token.value, JWT_SECRET);
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    await prisma.candidate.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to delete candidate.' }, { status: 500 });
  }
}

