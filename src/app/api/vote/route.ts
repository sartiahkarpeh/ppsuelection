// src/app/api/vote/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Make sure Prisma Client is correctly imported
import jwt from 'jsonwebtoken';

// Ensure this is loaded correctly and is IDENTICAL to the one used in /api/login
const JWT_SECRET = process.env.JWT_SECRET!;

export const dynamic = 'force-dynamic';

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

  // --- START: TEMPORARY LOGGING (Keep for now if you wish) ---
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
    voterId = payload.voterId; // voterId is extracted here
    console.log(`Vote API: Token verified successfully for voterId: ${voterId}`); // Log on success
  } catch (error: any) {
    // Log the actual error message from jwt.verify
    console.error("Vote API Error: Token verification failed.", error.message);
    // Return the standard error response
    return NextResponse.json({ error: 'Invalid or expired token.' }, { status: 401 });
  }

  // 3) & 4) Validate selections and Persist votes (OPTIMIZED LOGIC)
  try {
    const candidateIdsFromSelections = Object.values(selections);
    const positionIdsFromSelections = Object.keys(selections);

    // This check is technically redundant if the initial check for Object.keys(body.selections).length === 0 passes,
    // but kept for robustness within this specific logic block.
    if (candidateIdsFromSelections.length === 0) {
        console.warn('Vote API Warning: Selections object became empty before processing votes logic.');
        return NextResponse.json({ error: 'No selections to process.' }, { status: 400 });
    }

    // 1. Fetch all candidate details for the selections in ONE database call
    const selectedCandidatesDb = await prisma.candidate.findMany({
      where: {
        id: { in: candidateIdsFromSelections },
      },
      select: { id: true, positionId: true, name: true },
    });

    const candidatesMap = new Map(selectedCandidatesDb.map(c => [c.id, c]));

    // 2. Fetch all existing votes for this voter for ANY of the selected positions in ONE database call
    const existingVotesForUser = await prisma.vote.findMany({
      where: {
        voterId: voterId, // Use the voterId from JWT
        candidate: {
          positionId: { in: positionIdsFromSelections },
        },
      },
      select: {
        candidate: {
          select: { positionId: true, name: true },
        },
      },
    });

    const votedPositionIds = new Set(existingVotesForUser.map(v => v.candidate.positionId));
    const voteCreationData: { voterId: string; candidateId: string }[] = [];

    // 3. Perform validations IN MEMORY using the prefetched data
    for (const [positionIdFromSelection, candidateIdFromSelection] of Object.entries(selections)) {
      const candidate = candidatesMap.get(candidateIdFromSelection);

      if (!candidate || candidate.positionId !== positionIdFromSelection) {
        console.error(
          `Vote API Error: Invalid candidate ${candidateIdFromSelection} (Name: ${candidate?.name || 'N/A'}) for position ${positionIdFromSelection}. Candidate's actual position: ${candidate?.positionId}`
        );
        return NextResponse.json(
          { error: `Invalid candidate or position mismatch for one of your selections.` },
          { status: 400 }
        );
      }

      if (votedPositionIds.has(positionIdFromSelection)) {
        const existingVoteDetail = existingVotesForUser.find(v => v.candidate.positionId === positionIdFromSelection);
        console.log(
          `Vote API Info: Voter ${voterId} already voted for position ${positionIdFromSelection} (Candidate: ${existingVoteDetail?.candidate.name || 'N/A'}).`
        );
        return NextResponse.json(
          { error: `You have already cast a vote for the position titled for candidate ${candidate.name}.` }, // Referring to position by candidate might be confusing; consider position title if available.
          { status: 403 }
        );
      }

      voteCreationData.push({
        voterId: voterId, // Use the voterId from JWT
        candidateId: candidateIdFromSelection,
      });
    }

    // 4. If there are valid votes to create, batch create them in a transaction
    if (voteCreationData.length > 0) {
      await prisma.$transaction(
        voteCreationData.map(data => prisma.vote.create({ data }))
      );
      console.log(`Vote API Success: ${voteCreationData.length} votes recorded successfully for voter ${voterId}`);
    } else if (Object.keys(selections).length > 0) {
      // This case implies selections were made, but all were invalid (e.g., all duplicates or all for non-existent candidates)
      // The errors above should have caught these and returned. If it reaches here, it might mean no new valid actions.
      console.log(`Vote API Info: No new valid votes to record for voter ${voterId}. Selections might have been duplicates or otherwise invalid and handled.`);
      // Depending on desired behavior, you might return a specific message or just proceed to general success if errors were handled gracefully.
      // For now, if no error was thrown, but no votes created, it's a "soft" success or a state already achieved.
    }
    // If voteCreationData is empty AND no prior errors were thrown, it means there was nothing to do.

  } catch (e: any) {
    console.error('Vote processing or persistence error:', e);
    // Consider adding more specific error logging for Prisma errors if needed
    // if (e instanceof Prisma.PrismaClientKnownRequestError) { ... }
    return NextResponse.json(
      { error: 'Failed to process or record votes due to a server error.' },
      { status: 500 }
    );
  }
  // --- END VOTE PROCESSING ---

  // 5) All done! If we reached here without returning an error response, it's a success.
  return NextResponse.json({ success: true });
}
