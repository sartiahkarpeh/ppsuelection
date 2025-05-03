import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;

export async function POST(req: Request) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: 'Missing email or password.' }, { status: 400 });
  }

  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin || !(await bcrypt.compare(password, admin.password))) {
    return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
  }

  const token = jwt.sign({ adminId: admin.id }, JWT_SECRET, { expiresIn: '8h' });
  const res = NextResponse.json({ message: 'Login successful' });
  res.cookies.set({
    name:     'admin_token',
    value:    token,
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',    // use 'lax' for localhost
    path:     '/',
    maxAge:   8 * 60 * 60,
  });
  return res;
}

