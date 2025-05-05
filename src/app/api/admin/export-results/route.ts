// src/app/api/admin/export-results/route.ts
import { NextResponse }               from 'next/server';
import { prisma }                    from '@/lib/prisma';
import fs                            from 'fs/promises';
import path                          from 'path';
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

  // 1) load everything
  const all = await prisma.candidate.findMany({
    include: {
      position: { select: { title: true } },
      _count:   { select: { votes: true } },
    },
  });

  // 2) group by position title
  const byPos = all.reduce<Record<string, typeof all>>((acc, c) => {
    const t = c.position.title;
    (acc[t] ||= []).push(c);
    return acc;
  }, {});

  // 3) order positions by your priority (others last)
  const POSITION_PRIORITY = [
    'President',
    'Vice President',
    'Secretary',
    'Treasurer',
    'Chaplain',
    'Chair',
  ];
  const orderedPositions = [
    ...POSITION_PRIORITY.filter(t => t in byPos),
    ...Object.keys(byPos).filter(t => !POSITION_PRIORITY.includes(t)),
  ];

  // 4) start PDF
  const pdf   = await PDFDocument.create();
  const font  = await pdf.embedFont(StandardFonts.Helvetica);
  const fontB = await pdf.embedFont(StandardFonts.HelveticaBold);

  const [pageW, pageH] = [612, 792]; // US Letter
  let page     = pdf.addPage([pageW, pageH]);
  const margin    = 40;
  const xPhoto    = margin;
  const photoSize = 50;
  const xName     = xPhoto + photoSize + 10;
  const xParty    = xName + 200 + 10;
  const xVotes    = pageW - margin - 40;

  const entryH     = 60;
  const titleGap   = 24;
  const headerGap  = 20;
  const afterBlock = 12;

  let yCursor = pageH - margin;

  for (const title of orderedPositions) {
    if (yCursor < margin + entryH * 2) {
      page     = pdf.addPage([pageW, pageH]);
      yCursor = pageH - margin;
    }

    // Position heading
    page.drawText(title, {
      x: margin, y: yCursor, size: 16,
      font: fontB, color: rgb(0, 0, 0),
    });
    yCursor -= titleGap;

    // Column headers
    page.drawText('Photo',     { x: xPhoto, y: yCursor, size: 12, font: fontB });
    page.drawText('Candidate', { x: xName,  y: yCursor, size: 12, font: fontB });
    page.drawText('Party',     { x: xParty, y: yCursor, size: 12, font: fontB });
    page.drawText('Votes',     { x: xVotes, y: yCursor, size: 12, font: fontB });
    yCursor -= headerGap;

    // Each candidate
    for (const c of byPos[title]) {
      if (yCursor < margin + entryH) {
        page     = pdf.addPage([pageW, pageH]);
        yCursor = pageH - margin;
      }

      // embed & draw photo
      try {
        let imgBytes: Uint8Array;
        if (c.photoUrl?.startsWith('data:')) {
          imgBytes = Uint8Array.from(
            Buffer.from(c.photoUrl.split(',')[1], 'base64')
          );
        } else {
          const p = path.join(process.cwd(), 'public', c.photoUrl.replace(/^\/+/, ''));
          imgBytes = Uint8Array.from(await fs.readFile(p));
        }
        const img = await pdf.embedPng(imgBytes).catch(() => pdf.embedJpg(imgBytes));
        page.drawImage(img, {
          x: xPhoto,
          y: yCursor - photoSize + 5,
          width:  photoSize,
          height: photoSize,
        });
      } catch (e) {
        console.error('Photo embed error:', e);
      }

      const textY = yCursor - photoSize / 2 + 6;

      // name
      page.drawText(c.name, {
        x: xName, y: textY, size: 12, font: fontB, color: rgb(0, 0, 0),
      });
      // party
      page.drawText(c.party ?? 'Independent', {
        x: xParty, y: textY, size: 11, font, color: rgb(0.4, 0.4, 0.4),
      });
      // votes
      const vt = String(c._count.votes);
      const w  = font.widthOfTextAtSize(vt, 12);
      page.drawText(vt, {
        x: xVotes + (30 - w), y: textY, size: 12, font: fontB, color: rgb(0, 0, 0),
      });

      yCursor -= entryH;
    }

    yCursor -= afterBlock;
  }

  const pdfBytes = await pdf.save();
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': 'attachment; filename="results.pdf"',
    },
  });
}

