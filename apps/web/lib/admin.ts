import { NextResponse } from 'next/server';
import { getSessionUser, type SessionUser } from './auth';

export async function requireAdmin(): Promise<
    { user: SessionUser } | { response: NextResponse }
> {
    const user = await getSessionUser();
    if (!user) {
        return {
            response: NextResponse.json({ error: 'Sign in required' }, { status: 401 }),
        };
    }
    if (!user.isAdmin) {
        return {
            response: NextResponse.json({ error: 'Admin required' }, { status: 403 }),
        };
    }
    return { user };
}
