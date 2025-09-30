import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  // Public routes that don't require authentication
  const publicRoutes = ['/auth/login', '/auth/signup', '/auth/reset-password', '/unauthorized', '/setup'];
  const _isPublicRoute = publicRoutes.some(route => req.nextUrl.pathname.startsWith(route));

  // For now, let the client-side auth handle the protection
  // This middleware can be enhanced later with server-side auth checks
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
