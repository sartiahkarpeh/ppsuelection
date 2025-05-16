// src/app/api/admin/export-results/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';
import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib'; // Added PDFFont
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET!;

export const dynamic = 'force-dynamic';

// Helper function for text wrapping (optional, but good for reuse)
function breakTextIntoLines(text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);

        if (testWidth > maxWidth) {
            if (currentLine) { // If currentLine is not empty, push it
                lines.push(currentLine);
            }
            currentLine = word; // Start new line with current word
            // If a single word is longer than maxWidth, it will overflow.
            // For more robust handling, you might need to break words too.
            // But for party names, this should generally be okay.
            if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
                 lines.push(word); // Push the long word and let it overflow, or implement char-level break
                 currentLine = '';
            }

        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) { // Push any remaining text
        lines.push(currentLine);
    }
    return lines;
}


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
        'General Secretary',
        'Assistant Secretary',
        'Financial Secretary',
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
    const margin     = 40;
    const xPhoto     = margin;
    const photoSize = 50;
    const xName      = xPhoto + photoSize + 10;
    const xParty     = xName + 200 + 10; // Starting X for Party
    const xVotes     = pageW - margin - 40; // Starting X for Votes text (adjust if needed for alignment)

    const partyColumnMaxWidth = xVotes - xParty - 5; // Max width for party name, with 5 units padding before votes column

    const entryH     = 60; // Adjust this if text wrapping makes entries taller
    const titleGap   = 24;
    const headerGap  = 20;
    const afterBlock = 12;
    const lineHeight = 14; // Approximate line height for wrapped text (font size + leading)

    let yCursor = pageH - margin;

    for (const title of orderedPositions) {
        const isNewPageNeededForTitle = yCursor < margin + entryH * 2; // Initial check before drawing title

        if (isNewPageNeededForTitle) {
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
        page.drawText('Votes',     { x: xVotes, y: yCursor, size: 12, font: fontB }); // This xVotes aligns the "Votes" header
        yCursor -= headerGap;

        // Each candidate
        for (const c of byPos[title]) {
            const partyText = c.party ?? 'Independent';
            const partyTextSize = 11;
            const partyLines = breakTextIntoLines(partyText, partyColumnMaxWidth, font, partyTextSize);
            
            // Estimate height needed for this entry, considering wrapped party text
            const numberOfPartyLines = partyLines.length;
            // Base height is photoSize. If party text needs more lines, that dictates height.
            const currentEntryHeight = Math.max(photoSize + 10, numberOfPartyLines * lineHeight + (photoSize - partyTextSize) / 2); // Ensure enough space for photo and text

            if (yCursor < margin + currentEntryHeight) { // Use dynamic entry height
                page     = pdf.addPage([pageW, pageH]);
                yCursor = pageH - margin;
                // Redraw headers on new page
                page.drawText('Photo',     { x: xPhoto, y: yCursor - (titleGap + headerGap - 20), size: 12, font: fontB }); // A bit hacky to reposition headers after page break
                page.drawText('Candidate', { x: xName,  y: yCursor - (titleGap + headerGap - 20), size: 12, font: fontB });
                page.drawText('Party',     { x: xParty, y: yCursor - (titleGap + headerGap - 20), size: 12, font: fontB });
                page.drawText('Votes',     { x: xVotes, y: yCursor - (titleGap + headerGap - 20), size: 12, font: fontB });
            }

            // embed & draw photo
            try {
                let imgBytes: Uint8Array;
                if (c.photoUrl?.startsWith('data:')) {
                    imgBytes = Uint8Array.from(
                        Buffer.from(c.photoUrl.split(',')[1], 'base64')
                    );
                } else if (c.photoUrl) { // Check if photoUrl is not null/undefined
                    const p = path.join(process.cwd(), 'public', c.photoUrl.replace(/^\/+/, ''));
                    imgBytes = Uint8Array.from(await fs.readFile(p));
                } else {
                    throw new Error("Photo URL is missing");
                }
                const img = await pdf.embedPng(imgBytes).catch(async () => pdf.embedJpg(imgBytes)); // Added async for the catch
                page.drawImage(img, {
                    x: xPhoto,
                    y: yCursor - photoSize + 5, // Vertically center photo a bit if entryH is larger
                    width:  photoSize,
                    height: photoSize,
                });
            } catch (e: any) { // Explicitly type 'e' or use 'unknown' and check
                console.error(`Photo embed error for ${c.name} (URL: ${c.photoUrl}):`, e.message);
                // Optionally draw a placeholder box or text
                 page.drawText('No Photo', {
                    x: xPhoto + 5,
                    y: yCursor - photoSize / 2,
                    size: 8,
                    font: font,
                    color: rgb(0.5, 0.5, 0.5)
                });
            }

            const textYBaseline = yCursor - photoSize / 2 + 6; // Original baseline, good for single line text centered with photo

            // name (single line, usually fine)
            page.drawText(c.name, {
                x: xName, y: textYBaseline, size: 12, font: fontB, color: rgb(0, 0, 0),
            });

            // party (potentially multiple lines)
            let partyTextCurrentY = textYBaseline;
            // Adjust party text starting Y if it's multi-line to align better relative to the photo's vertical center
            // This simple adjustment might need refinement for perfect vertical centering of multi-line text block
            if (partyLines.length > 1) {
                 partyTextCurrentY = yCursor - ((currentEntryHeight - (numberOfPartyLines * partyTextSize)) / 2) - partyTextSize; // Center the block of text
            }


            for (let i = 0; i < partyLines.length; i++) {
                const line = partyLines[i];
                page.drawText(line, {
                    x: xParty,
                    y: partyTextCurrentY - (i * lineHeight), // Draw lines one below the other
                    size: partyTextSize,
                    font,
                    color: rgb(0.4, 0.4, 0.4),
                });
            }
            
            // votes
            const vt = String(c._count.votes);
            const voteTextWidth  = fontB.widthOfTextAtSize(vt, 12); // Use fontB as in drawText
            // Align votes to the right of their column
            page.drawText(vt, {
                x: xVotes + (30 - voteTextWidth), // xVotes is start, 30 is approx width of votes column for right align
                y: textYBaseline, // Align with candidate name
                size: 12,
                font: fontB,
                color: rgb(0, 0, 0),
            });

            yCursor -= currentEntryHeight; // Use dynamic entry height
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
