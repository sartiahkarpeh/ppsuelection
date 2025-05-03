// src/app/api/vote/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

// Ensure this is loaded correctly and is IDENTICAL to the one used in /api/login
const JWT_SECRET = process.env.JWT_SECRET!;

export async function POST(req: Request) {
  // 1) Parse & validate the incoming payload
  // --- Expects { selections: object } ---
  const body = await req.json().catch(() => null);
  if (!body || typeof body.selections !== 'object' || body.selections === null || Object.keys(body.selections).length === 0) {
     // Added check for null and empty object
    return NextResponse.json(
      { error: 'Missing or invalid selections object.' },
      { status: 400 }
    );
  }
  // Ensure selections is treated as Record<string, string>
  const selections: Record<string, string> = body.selections;
  // --- END PAYLOAD CHECK ---


  // 2) Extract & verify the JWT (sent as Bearer token)
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.split(' ')[1];
  if (!token) {
    console.error("Vote API Error: No token provided in Authorization header.");
    return NextResponse.json({ error: 'Unauthorized. Missing token.' }, { status: 401 });
  }

  // --- START: TEMPORARY LOGGING (Keep for now) ---
  const secretUsedForVerification = process.env.JWT_SECRET;
  console.log('\n--- VOTE API: Verifying token ---');
  console.log('Raw process.env.JWT_SECRET:', secretUsedForVerification);
  console.log('Secret Length:', secretUsedForVerification?.length);
  console.log('Token Received (First 10):', token?.substring(0, 10));
  console.log('--- END: TEMPORARY LOGGING ---\n');
  // --- END: TEMPORARY LOGGING ---

  let voterId: string;
  try {
    // *** Check your JWT_SECRET environment variable if this still fails! ***
    const payload = jwt.verify(token, JWT_SECRET!) as { voterId: string };
    voterId = payload.voterId;
    console.log(`Vote API: Token verified successfully for voterId: ${voterId}`); // Log on success
  } catch (error: any) {
    // Log the actual error message from jwt.verify
    console.error("Vote API Error: Token verification failed.", error.message);
    // Return the standard error response
    return NextResponse.json({ error: 'Invalid or expired token.' }, { status: 401 });
  }


  // 3) & 4) Validate selections and Persist votes
  // --- Loops through selections ---
  try {
    const voteCreationPromises: Promise<any>[] = [];

    for (const [positionId, candidateId] of Object.entries(selections)) {
      // a) Verify the candidate exists and belongs to this position
      const candidate = await prisma.candidate.findUnique({
        where: { id: candidateId },
        select: { positionId: true, name: true }
      });

      // Check if candidate exists and if their position matches the key in selections
      if (!candidate || candidate.positionId !== positionId) {
        console.error(`Vote API Error: Invalid candidate ${candidateId} or position mismatch for position ${positionId}.`);
        return NextResponse.json(
          { error: `Invalid candidate or position mismatch for selection.` },
          { status: 400 }
        );
      }

      // b) Check if the voter already voted for this position
      const existingVote = await prisma.vote.findFirst({
        where: {
          voterId,
          candidate: { positionId: positionId }
        },
        include: { candidate: { select: { name: true } } }
      });

      if (existingVote) {
         console.log(`Vote API Info: Voter ${voterId} already voted for position ${positionId} (Candidate: ${existingVote.candidate.name}).`);
        return NextResponse.json(
          { error: `You have already voted for the position: ${positionId}.` },
          { status: 403 }
        );
      }

      // If checks pass, prepare to create the vote record
      voteCreationPromises.push(
        prisma.vote.create({
          data: {
            voterId: voterId,
            candidateId: candidateId
          }
        })
      );
       // console.log(`Vote API: Queued vote for voter ${voterId}, candidate ${candidateId} (Position ${positionId})`); // Optional log
    }

    // Execute all vote creations
    await Promise.all(voteCreationPromises);

  } catch (e: any) {
    console.error('Vote processing or persistence error:', e);
    return NextResponse.json(
      { error: 'Failed to process or record votes due to a server error.' },
      { status: 500 }
    );
  }
  // --- END VOTE PROCESSING ---

  // 5) All done!
  console.log(`Vote API Success: All votes recorded successfully for voter ${voterId}`);
  return NextResponse.json({ success: true });
}
