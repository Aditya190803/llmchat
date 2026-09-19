import { prisma } from '@repo/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { todayStr } from '@/lib/tiers';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const gate = await requireAdmin();
    if ('response' in gate) return gate.response;

    const { id } = await params;
    if (id === gate.user.id) {
        return NextResponse.json({ error: 'Cannot change your own account here' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const data: Record<string, unknown> = {};

    if (typeof body.isPro === 'boolean') data.isPro = body.isPro;
    if (typeof body.isAdmin === 'boolean') data.isAdmin = body.isAdmin;
    if (body.dailyCredits === null || typeof body.dailyCredits === 'number') {
        data.dailyCredits = body.dailyCredits;
    }
    if (body.resetUsage === true) {
        data.creditsUsed = 0;
        data.lastResetDate = todayStr();
    }

    const user = await prisma.user.update({
        where: { id },
        data,
        select: {
            id: true,
            email: true,
            isAdmin: true,
            isPro: true,
            dailyCredits: true,
            creditsUsed: true,
            lastResetDate: true,
        },
    });
    return NextResponse.json({ user });
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const gate = await requireAdmin();
    if ('response' in gate) return gate.response;

    const { id } = await params;
    if (id === gate.user.id) {
        return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
}
