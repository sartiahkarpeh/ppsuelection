// src/app/api/admin/export-voters/route.ts
import { NextResponse } from 'next/server'
import { prisma }      from '@/lib/prisma'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export async function GET() {
  // 1) Fetch all verified voters
  const voters = await prisma.voter.findMany({
    where: { verification: { verified: true } },
    select: {
      fullName:     true,
      universityId: true,
      email:        true,
    },
    orderBy: { fullName: 'asc' },
  })

  // 2) Create PDF
  const pdf    = await PDFDocument.create()
  const font   = await pdf.embedFont(StandardFonts.Helvetica)
  const fontB  = await pdf.embedFont(StandardFonts.HelveticaBold)

  // US Letter: 612×792
  const [pageW, pageH] = [612, 792]
  const margin    = 40
  const rowHeight = 20
  const headerH   = 25

  // Column X positions
  const xName     = margin
  const xUniId    = xName + 200
  const xEmail    = xUniId + 150

  let page    = pdf.addPage([pageW, pageH])
  let yCursor = pageH - margin

  // Draw table header
  function drawHeader() {
    page.drawText('Name', {
      x: xName, y: yCursor, size: 12, font: fontB, color: rgb(0,0,0)
    })
    page.drawText('University ID', {
      x: xUniId, y: yCursor, size: 12, font: fontB, color: rgb(0,0,0)
    })
    page.drawText('Email', {
      x: xEmail, y: yCursor, size: 12, font: fontB, color: rgb(0,0,0)
    })
    yCursor -= headerH
  }

  drawHeader()

  // Draw each row
  for (const v of voters) {
    // Page break if we're too close to bottom
    if (yCursor < margin + rowHeight) {
      page    = pdf.addPage([pageW, pageH])
      yCursor = pageH - margin
      drawHeader()
    }

    // Name
    page.drawText(v.fullName, {
      x: xName, y: yCursor, size: 11, font: font, color: rgb(0,0,0)
    })
    // University ID
    page.drawText(v.universityId, {
      x: xUniId, y: yCursor, size: 11, font: font, color: rgb(0,0,0)
    })
    // Email
    page.drawText(v.email, {
      x: xEmail, y: yCursor, size: 11, font: font, color: rgb(0,0,0)
    })

    yCursor -= rowHeight
  }

  // 3) Return PDF
  const pdfBytes = await pdf.save()
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': 'attachment; filename="registered-voters.pdf"',
    },
  })
}

