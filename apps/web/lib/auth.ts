import { prisma } from '@repo/prisma';
import bcrypt from 'bcryptjs';
import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'llmchat_session';
const SESSION_DAYS = 7;

export type SessionUser = {
    id: string;
    email: string;
    isAdmin: boolean;
    isPro: boolean;
};

const secret = () =>
    new TextEncoder().encode(
        process.env.AUTH_JWT_SECRET || 'dev-only-change-me-in-prod-0123456789abcdef'
    );

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
export const verifyPassword = (password: string, hash: string) =>
    bcrypt.compare(password, hash);

export async function signSession(user: SessionUser) {
    return new SignJWT({ ...user })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${SESSION_DAYS}d`)
        .sign(secret());
}

export async function verifySession(token: string): Promise<SessionUser | null> {
    try {
        const { payload } = await jwtVerify(token, secret());
        if (
            typeof payload.id !== 'string' ||
            typeof payload.email !== 'string'
        ) {
            return null;
        }
        return {
            id: payload.id,
            email: payload.email,
            isAdmin: payload.isAdmin === true,
            isPro: payload.isPro === true,
        };
    } catch {
        return null;
    }
}

export async function getSessionUser(): Promise<SessionUser | null> {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const session = await verifySession(token);
    if (!session) return null;
    // Re-read flags from DB so admin/pro changes apply without re-login.
    const user = await prisma.user.findUnique({
        where: { id: session.id },
        select: { id: true, email: true, isAdmin: true, isPro: true },
    });
    return user;
}

export const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
