// src/app/api/admin/export-voters/route.ts
import { NextResponse }               from 'next/server';
import { prisma }                    from '@/lib/prisma';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import jwt                           from 'jsonwebtoken';
import { cookies }                   from 'next/headers';

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

  // 1) Fetch all verified voters
  const voters = await prisma.voter.findMany({
    where: { verification: { verified: true } },
    select: {
      fullName:     true,
      universityId: true,
      email:        true,
    },
    orderBy: { fullName: 'asc' },
  });

  // 2) Create PDF
  const pdf   = await PDFDocument.create();
  const font  = await pdf.embedFont(StandardFonts.Helvetica);
  const fontB = await pdf.embedFont(StandardFonts.HelveticaBold);

  const [pageW, pageH] = [612, 792]; // US Letter
  const margin    = 40;
  const rowHeight = 20;
  const headerH   = 25;

  // Column positions
  const xName  = margin;
  const xUniId = xName + 200;
  const xEmail = xUniId + 150;

  let page    = pdf.addPage([pageW, pageH]);
  let yCursor = pageH - margin;

  // Draw header
  function drawHeader() {
    page.drawText('Name', {
      x: xName, y: yCursor, size: 12, font: fontB, color: rgb(0, 0, 0),
    });
    page.drawText('University ID', {
      x: xUniId, y: yCursor, size: 12, font: fontB, color: rgb(0, 0, 0),
    });
    page.drawText('Email', {
      x: xEmail, y: yCursor, size: 12, font: fontB, color: rgb(0, 0, 0),
    });
    yCursor -= headerH;
  }

  drawHeader();

  // Draw rows
  for (const v of voters) {
    if (yCursor < margin + rowHeight) {
      page    = pdf.addPage([pageW, pageH]);
      yCursor = pageH - margin;
      drawHeader();
    }

    page.drawText(v.fullName, {
      x: xName, y: yCursor, size: 11, font, color: rgb(0, 0, 0),
    });
    page.drawText(v.universityId, {
      x: xUniId, y: yCursor, size: 11, font, color: rgb(0, 0, 0),
    });
    page.drawText(v.email, {
      x: xEmail, y: yCursor, size: 11, font, color: rgb(0, 0, 0),
    });

    yCursor -= rowHeight;
  }

  const pdfBytes = await pdf.save();
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': 'attachment; filename="registered-voters.pdf"',
    },
  });
}

