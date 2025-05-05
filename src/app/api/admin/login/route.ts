// src/app/api/admin/login/route.ts
import { NextResponse } from 'next/server';
import { prisma }      from '@/lib/prisma';
import bcrypt          from 'bcryptjs';       // ← use bcryptjs, not bcrypt
import jwt             from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    console.log('Admin login request received');

    const { email, password } = await req.json();
    if (!email || !password) {
      console.log('Admin login failed: Missing email or password');
      return NextResponse.json({ error: 'Missing email or password.' }, { status: 400 });
    }
    console.log(`Attempting login for email: ${email}`);

    console.log('Finding admin user...');
    const admin = await prisma.admin.findUnique({ where: { email } });
    console.log('Admin lookup complete. Found:', !!admin);

    let passwordMatch = false;
    if (admin && admin.password) {
      console.log('Comparing passwords...');
      passwordMatch = await bcrypt.compare(password, admin.password);
      console.log('Password comparison complete. Match:', passwordMatch);
    } else if (admin) {
      console.log('Admin found but no password field exists or is null!');
    } else {
      console.log('Admin email not found in database.');
    }

    if (!admin || !passwordMatch) {
      console.log('Admin login failed: Invalid credentials');
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    console.log('Credentials verified. Signing JWT...');
    const token = jwt.sign({ adminId: admin.id }, JWT_SECRET, { expiresIn: '8h' });
    console.log('JWT signed successfully.');

    const res = NextResponse.json({ message: 'Login successful' });

    console.log('Setting admin_token cookie...');
    res.cookies.set({
      name:     'admin_token',
      value:    token,
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path:     '/',
      maxAge:   8 * 60 * 60, // 8 hours
    });
    console.log('Cookie set. Returning success response.');

    return res;
  } catch (error: any) {
    console.error('!!! Critical error in /api/admin/login:', error);
    if (error.message) console.error('Error Message:', error.message);
    if (error.stack)   console.error('Error Stack:', error.stack);
    return NextResponse.json(
      { error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}

