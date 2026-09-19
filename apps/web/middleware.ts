import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySession } from './lib/auth';

const PUBLIC_ADMIN_PATHS = ['/admin/login'];

export default async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api/auth') ||
        pathname.includes('.')
    ) {
        return NextResponse.next();
    }

    // Chat and all non-admin pages/API routes are public.
    if (!pathname.startsWith('/admin') && !pathname.startsWith('/api/admin')) {
        return NextResponse.next();
    }

    if (PUBLIC_ADMIN_PATHS.includes(pathname)) {
        return NextResponse.next();
    }

    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const session = token ? await verifySession(token) : null;
    const isApi = pathname.startsWith('/api/');

    if (!session) {
        if (isApi) {
            return NextResponse.json({ error: 'Admin sign in required' }, { status: 401 });
        }
        const url = request.nextUrl.clone();
        url.pathname = '/admin/login';
        return NextResponse.redirect(url);
    }

    if (!session.isAdmin) {
        if (isApi) {
            return NextResponse.json({ error: 'Admin required' }, { status: 403 });
        }
        const url = request.nextUrl.clone();
        url.pathname = '/chat';
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.svg).*)'],
};
