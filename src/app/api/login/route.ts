// src/app/api/login/route.ts
import { NextResponse } from 'next/server';
import { prisma }       from '@/lib/prisma';
import jwt               from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;

export async function POST(request: Request) {
  const { voterId, dateOfBirth } = await request.json();

  if (!voterId || !dateOfBirth) {
    return NextResponse.json(
      { error: 'Missing voterId or dateOfBirth.' },
      { status: 400 }
    );
  }

  // 1) Fetch voter + their verification record
  const voter = await prisma.voter.findUnique({
    where:   { id: voterId },
    include: { verification: true },
  });

  if (!voter) {
    return NextResponse.json(
      { error: 'Voter not found.' },
      { status: 404 }
    );
  }

  if (!voter.verification?.verified) {
    return NextResponse.json(
      { error: 'Email not verified.' },
      { status: 403 }
    );
  }

  if (voter.dateOfBirth.toISOString().slice(0, 10) !== dateOfBirth) {
    return NextResponse.json(
      { error: 'Incorrect date of birth.' },
      { status: 401 }
    );
  }

  // 2) Check if they’ve already cast any vote
  const alreadyVoted = await prisma.vote.findFirst({
    where: { voterId: voter.id }
  });

  if (alreadyVoted) {
    return NextResponse.json(
      { error: 'You have already voted.' },
      { status: 403 }
    );
  }

  // 3) Sign a JWT and return it
  const token = jwt.sign(
    { voterId: voter.id },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  return NextResponse.json({ token });
}

