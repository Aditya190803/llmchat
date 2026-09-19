import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

const BASE = process.env.AI_GATEWAY_BASE_URL || 'https://ai-gateway.adityamer.dev/v1';

export async function GET() {
    const gate = await requireAdmin();
    if ('response' in gate) return gate.response;

    const key = process.env.AI_GATEWAY_API_KEY;
    if (!key) {
        return NextResponse.json({ ok: false, error: 'AI_GATEWAY_API_KEY not set on server' });
    }

    try {
        const res = await fetch(`${BASE}/models`, {
            headers: { authorization: `Bearer ${key}` },
        });
        if (!res.ok) {
            return NextResponse.json({ ok: false, error: `Gateway responded ${res.status}` });
        }
        const json = await res.json();
        const ids: string[] = (json.data || []).map((m: { id: string }) => m.id);
        return NextResponse.json({ ok: true, baseUrl: BASE, count: ids.length, models: ids });
    } catch (error) {
        return NextResponse.json({ ok: false, error: String(error) });
    }
}
