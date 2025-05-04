import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  console.log("!!! Admin Login API Hit - Simplified Version !!!");
  // Directly return success without any logic
  return NextResponse.json({ message: 'Simplified response OK' });
}