import { prisma } from '@repo/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { FREE_DEFAULT_MODELS } from '@/lib/tiers';

const BASE = process.env.AI_GATEWAY_BASE_URL || 'https://ai-gateway.adityamer.dev/v1';

type GatewayModel = { id: string };

async function fetchGatewayModels(): Promise<string[]> {
    const key = process.env.AI_GATEWAY_API_KEY;
    if (!key) throw new Error('AI_GATEWAY_API_KEY is not configured on the server');

    const response = await fetch(`${BASE}/models`, {
        headers: { authorization: `Bearer ${key}` },
        cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Gateway responded ${response.status}`);

    const json = (await response.json()) as { data?: GatewayModel[] };
    return Array.from(new Set((json.data || []).map(model => model.id).filter(Boolean))).sort();
}

export async function GET() {
    const gate = await requireAdmin();
    if ('response' in gate) return gate.response;

    try {
        const models = await fetchGatewayModels();
        await Promise.all(
            models.map(mode =>
                prisma.modelPolicy.upsert({
                    where: { mode },
                    update: {},
                    create: {
                        mode,
                        freeAllowed: FREE_DEFAULT_MODELS.has(mode),
                        proAllowed: true,
                    },
                })
            )
        );

        const policies = await prisma.modelPolicy.findMany({
            where: { mode: { in: models } },
            orderBy: { mode: 'asc' },
        });
        return NextResponse.json({ models, policies, baseUrl: BASE });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 502 });
    }
}

export async function PATCH(request: NextRequest) {
    const gate = await requireAdmin();
    if ('response' in gate) return gate.response;

    const { mode, freeAllowed, proAllowed } = await request.json().catch(() => ({}));
    if (!mode) {
        return NextResponse.json({ error: 'model id required' }, { status: 400 });
    }

    const data: Record<string, boolean> = {};
    if (typeof freeAllowed === 'boolean') data.freeAllowed = freeAllowed;
    if (typeof proAllowed === 'boolean') data.proAllowed = proAllowed;

    const policy = await prisma.modelPolicy.upsert({
        where: { mode },
        update: data,
        create: {
            mode,
            freeAllowed: data.freeAllowed ?? false,
            proAllowed: data.proAllowed ?? true,
        },
    });
    return NextResponse.json({ policy });
}
