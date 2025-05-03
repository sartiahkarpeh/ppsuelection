// src/app/api/admin/candidates/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/candidates
 * Fetch all candidates (with position title) in alphabetical order
 */
export async function GET() {
  try {
    const candidates = await prisma.candidate.findMany({
      include: {
        position: {
          select: { title: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    // Flatten position.title into top-level
    const data = candidates.map((c) => ({
      id:       c.id,
      name:     c.name,
      party:    c.party,
      position: c.position.title,
      photoUrl: c.photoUrl,
    }))

    return NextResponse.json(data)
  } catch (e) {
    console.error('Fetch candidates error:', e)
    return NextResponse.json(
      { error: 'Failed to fetch candidates.' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/candidates
 * Add a new candidate (creates position if missing)
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body || !body.name || !body.position) {
    return NextResponse.json(
      { error: 'Missing name or position.' },
      { status: 400 }
    )
  }
  const { name, party, position } = body

  try {
    // find existing position by title, or create if not found
    let pos = await prisma.position.findFirst({
      where: { title: position },
    })
    if (!pos) {
      pos = await prisma.position.create({
        data: { title: position },
      })
    }

    // create the candidate
    const cand = await prisma.candidate.create({
      data: {
        name,
        party,
        positionId: pos.id,
        photoUrl: '', // start blank
      },
    })

    return NextResponse.json(cand, { status: 201 })
  } catch (e: any) {
    console.error('Add candidate error:', e)
    return NextResponse.json(
      { error: 'Failed to add candidate.' },
      { status: 500 }
    )
  }
}

