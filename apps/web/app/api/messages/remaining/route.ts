import { getModelFromChatMode } from '@repo/ai/models';
import { prisma } from '@repo/prisma';
import { ChatMode } from '@repo/shared/config';
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { FREE_DEFAULT_MODELS, getQuota, getVisitorQuota } from '@/lib/tiers';
import { defaultModelFor } from '@repo/shared/config';

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

    // Mirrors canUseMode(): an explicit policy overrides the free defaults.
    const isPrivileged = !!session?.isPro || !!session?.isAdmin;
    const allowedModes = Object.values(ChatMode).filter(mode => {
        const policy = policies.find(p => p.mode === getModelFromChatMode(mode));
        if (isPrivileged) return policy?.proAllowed !== false;
        if (!policy) return FREE_DEFAULT_MODELS.has(getModelFromChatMode(mode));
        return policy.freeAllowed === true;
    });

    return NextResponse.json({
        remaining: quota.remaining,
        maxLimit: quota.limit,
        isPro: quota.isPro,
        isAdmin: session?.isAdmin ?? false,
        allowedModes,
        defaultModel: defaultModelFor(isPrivileged),
        isAuthenticated: !!session,
        isFetched: true,
    });
}
