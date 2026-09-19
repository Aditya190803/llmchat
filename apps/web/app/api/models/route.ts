import { getSessionUser } from '@/lib/auth';
import { FREE_DEFAULT_MODELS } from '@/lib/tiers';
import { prisma } from '@repo/prisma';
import { groupGatewayModels } from '@repo/shared/config';
import { NextResponse } from 'next/server';

const BASE = process.env.AI_GATEWAY_BASE_URL || 'https://ai-gateway.adityamer.dev/v1';

type GatewayModel = { id: string };

export async function GET() {
    const key = process.env.AI_GATEWAY_API_KEY;
    if (!key) {
        return NextResponse.json({ error: 'Gateway is not configured' }, { status: 503 });
    }

    try {
        const response = await fetch(`${BASE}/models`, {
            headers: { authorization: `Bearer ${key}` },
            cache: 'no-store',
        });
        if (!response.ok) {
            return NextResponse.json({ error: `Gateway responded ${response.status}` }, { status: 502 });
        }

        const json = (await response.json()) as { data?: GatewayModel[] };
        const models = Array.from(
            new Set((json.data || []).map(model => model.id).filter(Boolean))
        ).sort();
        const policies = await prisma.modelPolicy.findMany({ where: { mode: { in: models } } });
        const session = await getSessionUser();
        const isPrivileged = !!session?.isPro || !!session?.isAdmin;
        const allowedModels = models.filter(model => {
            const policy = policies.find(item => item.mode === model);
            return isPrivileged
                ? policy?.proAllowed !== false
                : policy?.freeAllowed === true || FREE_DEFAULT_MODELS.has(model);
        });

        return NextResponse.json({
            models,
            allowedModels,
            families: groupGatewayModels(models, allowedModels),
            baseUrl: BASE,
        });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 502 });
    }
}
