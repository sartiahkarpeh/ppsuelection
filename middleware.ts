// middleware.ts
import { NextResponse }    from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    // … admin guard …
  }
  if (pathname.startsWith('/party') && pathname !== '/party/login') {
    // … party-rep guard …
  }

  // everything else (including /api/vote) continues without redirection
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/party/:path*']
}

