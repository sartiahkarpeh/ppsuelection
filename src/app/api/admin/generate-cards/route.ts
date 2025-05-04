// src/app/api/admin/generate-cards/route.ts
import { NextResponse }                     from 'next/server';
import { prisma }                          from '@/lib/prisma';
import fs                                  from 'fs/promises';
import path                                from 'path';
import nodemailer                          from 'nodemailer';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT!),
  secure: false,
  auth:   { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
});

export const dynamic = 'force-dynamic';
export async function POST() {
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

  // 3) Generate a PDF+email for each voter
  await Promise.all(voters.map(async (v) => {
    const pdf   = await PDFDocument.create();
    const bgImg = await pdf.embedPng(tmplBuf);
    const { width: W, height: H } = bgImg.size();
    const page = pdf.addPage([W, H]);

    // Draw background
    page.drawImage(bgImg, { x: 0, y: 0, width: W, height: H });

    // Define your photo frame circle once, so it's in scope for both image & text
    const circle = { x: 60, y: H - 200, diameter: 500 };

    // Draw circular voter photo
    try {
      let imgBytes: Uint8Array;
      if (v.photoUrl.startsWith('data:')) {
        const b64 = v.photoUrl.split(',')[1];
        imgBytes = Uint8Array.from(Buffer.from(b64, 'base64'));
      } else {
        imgBytes = Uint8Array.from(
          await fs.readFile(path.join(process.cwd(), 'public', v.photoUrl))
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

    // ——— DRAW VOTER’S DATA FIELDS ———
    const fieldFontSize = 36;  

// start just below top of circle
let ty = circle.y - 150;  
const tx = circle.x + circle.diameter + 30;

function drawLine(label: string, value: string) {
  const labelText = label + ': ';
  // draw label
  page.drawText(labelText, {
    x: tx,
    y: ty,
    size: fieldFontSize,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  // measure at the same size you drew
  const labelWidth = fontBold.widthOfTextAtSize(labelText, fieldFontSize);

  // draw value a little bit to the right
  page.drawText(value, {
    x: tx + labelWidth + 10,  // 10px extra padding after the label
    y: ty,
    size: fieldFontSize,
    font,
    color: rgb(0, 0, 0),
  });

  // move down by “size + some extra leading”
  ty -= fieldFontSize + 12;
}

    drawLine('University ID', v.universityId);
    drawLine('Email',         v.email);
    drawLine('Course',        v.course);
    drawLine('Phone',         v.phoneNumber);
    drawLine(
      'DOB',
      new Date(v.dateOfBirth).toLocaleDateString('en-GB')
    );
    drawLine('Voting ID',     v.id);

    // Draw bottom name bar
    const barHeight = 80;
    page.drawRectangle({
      x: 0,
      y: 0,
      width: W,
      height: barHeight,
      color: rgb(0, 0, 0),
    });
    const footerY = 100;
    page.drawText(v.fullName, {
      x: 40,
      y: footerY, 
      size: 100,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    // Save PDF bytes
    const pdfBytes = await pdf.save();

    // Build the voting link
    const voteLink = `${process.env.APP_URL}/login?voterId=${v.id}`;

    // Send the email with attachment + link
    await transporter.sendMail({
      from:    `"IEC Voting" <${process.env.SMTP_USER}>`,
      to:      v.email,
      subject: 'Your IEC Digital Voting Card & Link',
      text: `
Hello ${v.fullName},

Thank you for verifying for the African Students Election at P P Savani University.

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
}

