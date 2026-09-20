import { FREE_MODEL_IDS, isSelectableModel } from '@repo/shared/config';
import { getModelFromChatMode } from '@repo/ai/models';
import { prisma } from '@repo/prisma';
import type { SessionUser } from './auth';

export const FREE_DAILY_CREDITS = 10;
export const PRO_DAILY_CREDITS = 200;
export const FREE_DEFAULT_MODELS = new Set(FREE_MODEL_IDS);

export const todayStr = () => new Date().toISOString().split('T')[0];

export type Quota = {
    limit: number;
    used: number;
    remaining: number;
    isPro: boolean;
};

type QuotaRecord = {
    isPro: boolean;
    dailyCredits: number | null;
    creditsUsed: number;
    lastResetDate: string;
};

export async function getQuota(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    const normalized = await resetIfNeeded(user, 'user');
    return { user: normalized, ...quotaOf(normalized) };
}

export async function getVisitorQuota(ip: string) {
    const visitor = await prisma.visitorUsage.upsert({
        where: { ip },
        update: {},
        create: { ip, lastResetDate: todayStr() },
    });
    const normalized = await resetIfNeeded(visitor, 'visitor');
    return { visitor: normalized, ...quotaOf(normalized) };
}

async function resetIfNeeded(record: QuotaRecord & { id: string }, kind: 'user' | 'visitor') {
    if (record.lastResetDate === todayStr()) return record;
    if (kind === 'user') {
        return prisma.user.update({
            where: { id: record.id },
            data: { creditsUsed: 0, lastResetDate: todayStr() },
        });
    }
    return prisma.visitorUsage.update({
        where: { id: record.id },
        data: { creditsUsed: 0, lastResetDate: todayStr() },
    });
}

function quotaOf(record: QuotaRecord): Quota {
    const limit = tierLimit(record.isPro, record.dailyCredits);
    return {
        limit,
        used: record.creditsUsed,
        remaining: Math.max(0, limit - record.creditsUsed),
        isPro: record.isPro,
    };
}

export function tierLimit(isPro: boolean, override: number | null) {
    return override ?? (isPro ? PRO_DAILY_CREDITS : FREE_DAILY_CREDITS);
}

export async function spendCredits(userId: string, cost: number): Promise<boolean> {
    const q = await getQuota(userId);
    if (!q || q.remaining < cost) return false;
    const updated = await prisma.user.updateMany({
        where: {
            id: userId,
            lastResetDate: todayStr(),
            creditsUsed: { lte: q.limit - cost },
        },
        data: { creditsUsed: { increment: cost } },
    });
    return updated.count === 1;
}

export async function spendVisitorCredits(ip: string, cost: number): Promise<boolean> {
    const q = await getVisitorQuota(ip);
    if (q.remaining < cost) return false;
    const updated = await prisma.visitorUsage.updateMany({
        where: {
            ip,
            lastResetDate: todayStr(),
            creditsUsed: { lte: q.limit - cost },
        },
        data: { creditsUsed: { increment: cost } },
    });
    return updated.count === 1;
}

export async function canUseMode(user: SessionUser | null, mode: string): Promise<boolean> {
    const gatewayModel = getModelFromChatMode(mode);
    // Speech, classifiers and retired generations are never selectable, whatever
    // a stale policy row says.
    if (!isSelectableModel(gatewayModel)) return false;
    const policy = await prisma.modelPolicy.findUnique({ where: { mode: gatewayModel } });
    if (!policy) {
        return user?.isPro || user?.isAdmin || FREE_DEFAULT_MODELS.has(gatewayModel);
    }
    return user?.isPro || user?.isAdmin ? policy.proAllowed : policy.freeAllowed;
}
