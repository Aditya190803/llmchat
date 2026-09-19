import { prisma } from '@repo/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, signSession, verifyPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
    const { email, password } = await request.json().catch(() => ({}));

    if (!email || !password) {
        return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
        where: { email: String(email).toLowerCase().trim() },
    });
    if (!user || !(await verifyPassword(String(password), user.passwordHash))) {
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = await signSession({
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
        isPro: user.isPro,
    });
    const res = NextResponse.json({
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin, isPro: user.isPro },
    });
    res.cookies.set(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
    });
    return res;
}
