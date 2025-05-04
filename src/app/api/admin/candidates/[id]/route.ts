// src/app/api/admin/candidates/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers'; // <--- 1. ADD THIS IMPORT

const JWT_SECRET = process.env.JWT_SECRET!;

// PATCH: update name, party, position (by title), photoUrl
export async function PATCH(
  req: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  const { id } = context.params;

  // auth guard
  const token = cookies().get('admin_token'); // <--- 2. CHANGE THIS LINE (use cookies())
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    jwt.verify(token.value, JWT_SECRET);
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const data: any = {};
  if (body.photoUrl) data.photoUrl = body.photoUrl;
  if (body.name) data.name = body.name;
  if (body.party !== undefined) data.party = body.party;

  if (body.position) {
    const pos = await prisma.position.upsert({
      where: { title: body.position },
      // Assuming title is unique now, otherwise this upsert needs adjustment
      // If title is NOT unique, use findFirst+create pattern here too
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
      where: { id: id },
      data,
      include: { // Include position to get the title back easily
        position: { select: { title: true } }
      }
    });
    return NextResponse.json({
      message: 'Candidate updated.',
      candidate: {
        id: updated.id,
        name: updated.name,
        party: updated.party,
        position: updated.position.title, // Get title from included relation
        photoUrl: updated.photoUrl,
      },
    });
  } catch (e) {
    console.error("Update candidate error:", e);
    return NextResponse.json({ error: 'Failed to update candidate.' }, { status: 500 });
  }
}

// DELETE: remove a candidate

export async function DELETE(
  req: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  const { id } = context.params;

  // auth guard
  const token = cookies().get('admin_token'); // <--- 3. CHANGE THIS LINE TOO (use cookies())
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    jwt.verify(token.value, JWT_SECRET);
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    await prisma.candidate.delete({ where: { id: id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Delete candidate error:", e);
    return NextResponse.json({ error: 'Failed to delete candidate.' }, { status: 500 });
  }
}
