// src/app/api/admin/generate-cards/route.ts
import { NextResponse }                     from 'next/server';
import { prisma }                          from '@/lib/prisma';
import fs                                  from 'fs/promises';
import path                                from 'path';
import nodemailer                          from 'nodemailer';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import jwt                                 from 'jsonwebtoken';
import { cookies }                         from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET!;

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT!),
  secure: false,
  auth:   { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
});

export const dynamic = 'force-dynamic';

export async function POST() {
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

  try {
    // 1) Fetch all verified voters
    const voters = await prisma.voter.findMany({
      where: { verification: { verified: true } },
      select: {
        id: true,
        fullName: true,
        photoUrl: true,
        universityId: true,
        email: true,
        course: true,
        phoneNumber: true,
        dateOfBirth: true,
      },
    });

    // 2) Pre-load card template & IEC logo
    const tmplPath = path.join(process.cwd(), 'public', 'card-template.png');
    const logoPath = path.join(process.cwd(), 'public', 'iec-logo.png');
    const [tmplBuf, logoBuf] = await Promise.all([
      fs.readFile(tmplPath),
      fs.readFile(logoPath),
    ]);

    // 3) Generate a PDF + email for each voter
    await Promise.all(voters.map(async (v) => {
      const pdf   = await PDFDocument.create();
      const bgImg = await pdf.embedPng(tmplBuf);
      const { width: W, height: H } = bgImg.size();
      const page = pdf.addPage([W, H]);

      // Draw background
      page.drawImage(bgImg, { x: 0, y: 0, width: W, height: H });

      // Define photo circle
      const circle = { x: 60, y: H - 200, diameter: 500 };

      // Draw circular voter photo
      try {
        let imgBytes: Uint8Array;
        if (v.photoUrl?.startsWith('data:')) {
          const b64 = v.photoUrl.split(',')[1];
          imgBytes = Uint8Array.from(Buffer.from(b64, 'base64'));
        } else {
          imgBytes = Uint8Array.from(
            await fs.readFile(path.join(process.cwd(), 'public', v.photoUrl || ''))
          );
        }
        let photo = await pdf.embedPng(imgBytes).catch(() => pdf.embedJpg(imgBytes));
        const { width: iw, height: ih } = photo.size();

        const scale = circle.diameter / Math.min(iw, ih);
        const pw = iw * scale, ph = ih * scale;
        const px = circle.x + (circle.diameter - pw) / 2;
        const py = circle.y - circle.diameter + (circle.diameter - ph) / 2;

        page.drawImage(photo, { x: px, y: py, width: pw, height: ph });
      } catch (err) {
        console.error(`Photo error for ${v.id}:`, err);
      }

      // Draw IEC logo top-right
      try {
        const logo = await pdf.embedPng(logoBuf);
        const logoH = 300;
        const logoW = (logo.width / logo.height) * logoH;
        page.drawImage(logo, {
          x: W - logoW - 60,
          y: H - logoH - 60,
          width: logoW,
          height: logoH,
        });
      } catch (err) {
        console.error('Logo error:', err);
      }

      // Prepare fonts
      const font     = await pdf.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

      // Draw voter’s data
      const fieldFontSize = 36;
      let ty = circle.y - 150;
      const tx = circle.x + circle.diameter + 30;

      function drawLine(label: string, value: string) {
        const labelText = label + ': ';
        page.drawText(labelText, {
          x: tx,
          y: ty,
          size: fieldFontSize,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        const labelWidth = fontBold.widthOfTextAtSize(labelText, fieldFontSize);
        page.drawText(value, {
          x: tx + labelWidth + 10,
          y: ty,
          size: fieldFontSize,
          font,
          color: rgb(0, 0, 0),
        });
        ty -= fieldFontSize + 12;
      }

      drawLine('University ID',   v.universityId);
      drawLine('Email',           v.email);
      drawLine('Course',          v.course);
      drawLine('Phone',           v.phoneNumber);
      drawLine('DOB',             new Date(v.dateOfBirth).toLocaleDateString('en-GB'));
      drawLine('Voting ID',       v.id);

      // Bottom name bar
      page.drawRectangle({
        x: 0,
        y: 0,
        width: W,
        height: 80,
        color: rgb(0, 0, 0),
      });
      page.drawText(v.fullName, {
        x: 40,
        y: 100,
        size: 100,
        font: fontBold,
        color: rgb(1, 1, 1),
      });

      // Save PDF
      const pdfBytes = await pdf.save();

      // YOUR VOTING LINK
      const voteLink = `https://electionppsu.netlify.app/login`;

      // Send email
      await transporter.sendMail({
        from:    `"IEC Voting" <${process.env.SMTP_USER}>`,
        to:      v.email,
        subject: 'Your IEC Digital Voting Card & Link',
        text: `
Hello ${v.fullName},

Thank you for verifying for the African Students Election at P P Savani University.

Your Voting ID: ${v.id}
Your voting link (active on election day): ${voteLink}

Please keep this card and link safe. On election day, click the link, log in with your Voting ID and Date of Birth, cast your vote, and you’re done!

Best regards,
IEC Voting Team
        `,
        attachments: [{
          filename: `${v.universityId}-VotingCard.pdf`,
          content:  Buffer.from(pdfBytes),
          contentType: 'application/pdf',
        }],
      });
    }));

    return NextResponse.json({ message: 'All voting cards have been sent.' });
  } catch (e: any) {
    console.error('POST /api/admin/generate-cards error:', e);
    return NextResponse.json(
      { error: 'Failed to generate and send voting cards.' },
      { status: 500 }
    );
  }
}

