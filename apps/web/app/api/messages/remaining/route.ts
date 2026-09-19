import { getModelFromChatMode } from '@repo/ai/models';
import { prisma } from '@repo/prisma';
import { ChatMode } from '@repo/shared/config';
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { FREE_DEFAULT_MODELS, getQuota, getVisitorQuota } from '@/lib/tiers';

const getVisitorIp = (request: Request) =>
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'local';

export async function GET(request: Request) {
    const session = await getSessionUser();
    const policies = await prisma.modelPolicy.findMany();
    const ip = getVisitorIp(request);
    const quota = session ? await getQuota(session.id) : await getVisitorQuota(ip);

    if (!quota) {
        return NextResponse.json({ error: 'Unable to load usage' }, { status: 500 });
    }

    const allowedModes = Object.values(ChatMode).filter(mode => {
        const policy = policies.find(p => p.mode === getModelFromChatMode(mode));
        return session?.isPro || session?.isAdmin
            ? policy?.proAllowed !== false
            : policy?.freeAllowed === true || FREE_DEFAULT_MODELS.has(getModelFromChatMode(mode));
    });

    return NextResponse.json({
        remaining: quota.remaining,
        maxLimit: quota.limit,
        isPro: quota.isPro,
        isAdmin: session?.isAdmin ?? false,
        allowedModes,
        isAuthenticated: !!session,
        isFetched: true,
    });
}
