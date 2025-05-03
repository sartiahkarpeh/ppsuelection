// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose'; // Recommended over 'jsonwebtoken' in edge middleware

const JWT_SECRET_UINT8 = new TextEncoder().encode(process.env.JWT_SECRET!);

const ADMIN_DASHBOARD_PATH = '/admin/dashboard'; // Or your main admin page
const LOGIN_PATH = '/admin/login';
const API_LOGIN_PATH = '/api/admin/login';

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const tokenCookie = req.cookies.get('admin_token');
    const token = tokenCookie?.value;

    console.log(`Middleware processing path: ${pathname}`);
    console.log('>>> middleware sees adminToken:', token); // Keep this for debugging

    let isTokenValid = false;
    let payload: any = null;

    if (token) {
        try {
            // Use jose.jwtVerify for Edge compatibility
            const { payload: verifiedPayload } = await jwtVerify(token, JWT_SECRET_UINT8);
            payload = verifiedPayload; // You can use payload if needed later
            isTokenValid = true;
            console.log('Token verified successfully');
        } catch (error) {
            console.error('JWT Verification Error:', error);
            isTokenValid = false;
            // If verification fails, treat as if no token exists
        }
    }

    // If trying to access login page WITH a valid token, redirect to dashboard
    if (isTokenValid && (pathname === LOGIN_PATH /*|| pathname === API_LOGIN_PATH - don't block API */)) {
        console.log('Valid token found on login page, redirecting to dashboard');
        const url = req.nextUrl.clone();
        url.pathname = ADMIN_DASHBOARD_PATH;
        return NextResponse.redirect(url);
    }

    // If trying to access a protected admin path WITHOUT a valid token, redirect to login
    if (!isTokenValid && (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) && pathname !== LOGIN_PATH && pathname !== API_LOGIN_PATH) {
        console.log('No valid token found for protected route, redirecting to login');
        const url = req.nextUrl.clone();
        url.pathname = LOGIN_PATH;
        // Clear invalid cookie if present
        const response = NextResponse.redirect(url);
        if (tokenCookie) { // Only try to clear if it existed but was invalid
            response.cookies.set({ name: 'admin_token', value: '', maxAge: 0, path: '/' });
        }
        return response;
    }

    // Allow request to proceed if:
    // 1. Token is valid and path is protected
    // 2. Path is public (like /admin/login without a token, or /api/admin/login)
    console.log('Allowing request to proceed');
    return NextResponse.next();
}

// Define which paths the middleware should run on
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
        // Explicitly include API and admin paths if needed, but the above usually covers it
        // '/api/admin/:path*',
        // '/admin/:path*',
    ],
};
