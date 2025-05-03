// src/app/api/votes/live/route.ts
import { NextResponse } from 'next/server'
import { prisma }      from '@/lib/prisma'

export async function GET() {
  // Count votes per candidate, now including photoUrl & position
  const counts = await prisma.candidate.findMany({
    select: {
      id:       true,
      name:     true,
      party:    true,
      photoUrl: true,
      position: {
        select: { id: true, title: true }
      },
      _count:   { select: { votes: true } }
    }
  })

  // Shape: [{ id, name, party, photoUrl, position, votes }]
  const data = counts.map(c => ({
    id:       c.id,
    name:     c.name,
    party:    c.party,
    photoUrl: c.photoUrl,
    position: c.position,
    votes:    c._count.votes
  }))

  return NextResponse.json(data)
}

