// src/app/api/register/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import nodemailer from 'nodemailer'

// Helper to generate a 6-digit numeric code
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Create a reusable Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false, // use TLS?
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});


export async function POST(request: Request) {
  try {
    const {
      fullName,
      photoUrl,
      universityId,
      email,
      course,
      phoneNumber,
      dateOfBirth,
    } = await request.json();

    // ─── SIMPLE DUPLICATE CHECK HERE ───
    const already = await prisma.voter.findUnique({
      where: { universityId },
    });
    if (already) {
      return NextResponse.json(
        { error: 'This University ID is already registered.' },
        { status: 409 }
      );
    }
    // ────────────────────────────────────
    // Basic validation
    if (
      !fullName ||
      !photoUrl ||
      !universityId ||
      !email ||
      !course ||
      !phoneNumber ||
      !dateOfBirth
    ) {
      return NextResponse.json(
        { error: 'Missing one or more required fields.' },
        { status: 400 }
      );
    }

    // Generate codes
    const emailCode = generateCode();

    // Create Voter with nested Verification
    const voter = await prisma.voter.create({
      data: {
        fullName,
        photoUrl,
        universityId,
        email,
        course,
        phoneNumber,
        dateOfBirth: new Date(dateOfBirth),
        verification: {
          create: {
            emailCode,
            phoneCode: '',
          },
        },
      },
      select: {
        id: true,
      },
    });


// Send the email with Nodemailer
await transporter.sendMail({
  from: `"Voting Portal" <${process.env.SMTP_USER}>`,
  to: email,
  subject: 'Your Voting Portal Email Verification Code',
  text: `Hello ${fullName},\n\nYour email verification code is: ${emailCode}\n\nThank you for registering.`,
});


return NextResponse.json(
  { message: 'Registered successfully.', voterId: voter.id },
  { status: 201 }
);
} catch (error: any) {
console.error('Register error:', error);
return NextResponse.json(
  { error: 'Internal server error.' },
  { status: 500 }
);
}
}

