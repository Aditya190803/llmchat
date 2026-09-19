import { prisma } from '@repo/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { tierLimit, todayStr } from '@/lib/tiers';

export async function GET(request: NextRequest) {
    const gate = await requireAdmin();
    if ('response' in gate) return gate.response;

    const q = new URL(request.url).searchParams.get('q')?.toLowerCase().trim() || '';
    const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
            id: true,
            email: true,
            isAdmin: true,
            isPro: true,
            dailyCredits: true,
            creditsUsed: true,
            lastResetDate: true,
            createdAt: true,
        },
    });

    const today = todayStr();
    const filtered = q ? users.filter(u => u.email.toLowerCase().includes(q)) : users;

    return NextResponse.json({
        users: filtered.map(u => {
            const used = u.lastResetDate === today ? u.creditsUsed : 0;
            const limit = tierLimit(u.isPro, u.dailyCredits);
            return {
                ...u,
                isCurrent: u.id === gate.user.id,
                limit,
                used,
                remaining: Math.max(0, limit - used),
            };
        }),
    });
}
