// src/app/api/register/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import nodemailer from 'nodemailer';

// Helper to generate a 6-digit numeric code
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// --- REMOVED transporter creation from top level ---

export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  console.log('Register API route invoked.'); // Add entry log

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

    console.log(`Processing registration for ${email}, ID: ${universityId}`);

    // Basic validation
    if (
      !fullName || !photoUrl || !universityId || !email || !course || !phoneNumber || !dateOfBirth
    ) {
      console.log('Registration failed: Missing fields.');
      return NextResponse.json(
        { error: 'Missing one or more required fields.' },
        { status: 400 }
      );
    }

    // Check for duplicate University ID BEFORE trying to create
    console.log(`Checking duplicate ID: ${universityId}`);
    const already = await prisma.voter.findUnique({
      where: { universityId },
    });
    if (already) {
      console.log(`Registration failed: University ID ${universityId} already exists.`);
      return NextResponse.json(
        { error: 'This University ID is already registered.' },
        { status: 409 }
      );
    }
    console.log(`ID ${universityId} is unique.`);

    // Generate codes
    const emailCode = generateCode();
    console.log(`Generated email code for ${email}`);

    // Create Voter with nested Verification
    console.log(`Creating voter record for ${email}...`);
    const voter = await prisma.voter.create({
      data: {
        fullName,
        photoUrl,
        universityId,
        email,
        course,
        phoneNumber,
        dateOfBirth: new Date(dateOfBirth), // Ensure dateOfBirth is valid string format from client
        verification: {
          create: {
            emailCode,
            phoneCode: '', // Assuming phone code isn't used currently
          },
        },
      },
      select: {
        id: true, // Select only the ID we need
      },
    });
    console.log(`Voter record created with ID: ${voter.id}`);

    // --- Moved transporter creation inside the try block ---
    console.log('Creating Nodemailer transporter...');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT), // Still ensure SMTP_PORT is a valid number in env vars
      secure: Number(process.env.SMTP_PORT) === 465, // Standard secure port is 465, 587 uses STARTTLS (secure: false initially) - Adjust if needed for Gmail
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS, // Ensure this is an App Password for Gmail if 2FA is on
      },
      requireTLS: true, // Recommended for port 587
    });
    console.log('Transporter created. Sending verification email...');

    // Send the email with Nodemailer
    await transporter.sendMail({
      from: `"Voting Portal" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Your Voting Portal Email Verification Code',
      text: `Hello ${fullName},\n\nYour email verification code is: ${emailCode}\n\nThank you for registering.`,
      // html: `<b>Hello ${fullName}</b>...` // Optional: Add HTML version
    });
    console.log(`Verification email sent successfully to ${email}.`);

    return NextResponse.json(
      { message: 'Registered successfully. Please check your email for verification code.', voterId: voter.id },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('!!! Register error:', error); // Log the actual error
    if (error.message) console.error('Error message:', error.message);
    if (error.stack) console.error('Error stack:', error.stack);
    if (error.code) console.error('Error code:', error.code); // Prisma errors often have codes
    // Add more specific checks if needed, e.g., for Prisma unique constraint errors
     if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
         return NextResponse.json({ error: 'This email address is already registered.' }, { status: 409 });
     }

    return NextResponse.json(
      { error: 'Internal server error during registration.' },
      { status: 500 }
    );
  }
}
