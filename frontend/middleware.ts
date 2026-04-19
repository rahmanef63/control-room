import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/shared/auth/session';

export const runtime = 'nodejs';

const PUBLIC_PATHS = [
  '/login',
  '/api/auth/',
  '/api/health',
  '/manifest.webmanifest',
  '/sw.js',
  '/icon',
  '/apple-icon',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/favicon.ico') {
    const iconUrl = request.nextUrl.clone();
    iconUrl.pathname = '/icon';
    return NextResponse.rewrite(iconUrl);
  }

  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  if (isPublic) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('session')?.value;
  const secret = process.env.CONTROL_ROOM_SESSION_SECRET ?? '';

  if (!sessionCookie || !verifySession(sessionCookie, secret)) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
