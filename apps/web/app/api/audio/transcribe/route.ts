import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

/*
 * Transcription proxied to the AI gateway's OpenAI-compatible
 * /audio/transcriptions. Set AI_GATEWAY_TRANSCRIBE_MODEL to the model you
 * configured there (defaults to whisper-1). Without a working model the client
 * falls back to the browser's own speech recognition.
 */
const BASE = process.env.AI_GATEWAY_BASE_URL || 'https://ai-gateway.adityamer.dev/v1';
const CONFIGURED_MODEL = process.env.AI_GATEWAY_TRANSCRIBE_MODEL;
const MAX_BYTES = 25 * 1024 * 1024;

let cachedModel: { at: number; model: string | null } | null = null;

/**
 * The transcription model to use: whatever the operator configured, else the
 * best Whisper the gateway currently serves (turbo first, it is much faster).
 */
async function resolveModel(key: string): Promise<string | null> {
    if (CONFIGURED_MODEL) return CONFIGURED_MODEL;
    if (cachedModel && Date.now() - cachedModel.at < 60_000) return cachedModel.model;

    let model: string | null = null;
    try {
        const response = await fetch(`${BASE}/models`, {
            headers: { authorization: `Bearer ${key}` },
            cache: 'no-store',
        });
        const data = await response.json().catch(() => ({}));
        const ids: string[] = (data.data || [])
            .map((entry: { id?: string }) => entry.id)
            .filter((id: unknown): id is string => typeof id === 'string');
        const whispers = ids.filter(id => /whisper/i.test(id));
        model = whispers.find(id => /turbo/i.test(id)) ?? whispers[0] ?? null;
    } catch {
        model = null;
    }
    cachedModel = { at: Date.now(), model };
    return model;
}

export async function GET() {
    // The composer asks whether server transcription is worth trying; without a
    // model on the gateway it uses the browser engine instead.
    const key = process.env.AI_GATEWAY_API_KEY;
    // POST needs an account, so don't offer it to visitors: they keep the
    // browser engine rather than recording only to be turned away.
    const [user, model] = await Promise.all([
        getSessionUser(),
        key ? resolveModel(key) : Promise.resolve(null),
    ]);
    return NextResponse.json({ enabled: !!model && !!user, model });
}

export async function POST(request: NextRequest) {
    const key = process.env.AI_GATEWAY_API_KEY;
    if (!key)
        return NextResponse.json({ error: 'Transcription is not configured' }, { status: 503 });

    // Transcription costs money upstream, so it needs an account.
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Sign in to use voice input' }, { status: 401 });

    const model = await resolveModel(key);
    if (!model) {
        return NextResponse.json(
            { error: 'No transcription model on the gateway' },
            { status: 503 }
        );
    }

    const form = await request.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof Blob) || !file.size) {
        return NextResponse.json({ error: 'No audio received' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: 'Recording is too long' }, { status: 413 });
    }

    const upstream = new FormData();
    upstream.append('file', file, (file as File).name || 'audio.webm');
    upstream.append('model', model);
    const language = form?.get('language');
    if (typeof language === 'string' && language) upstream.append('language', language.slice(0, 8));

    try {
        const response = await fetch(`${BASE}/audio/transcriptions`, {
            method: 'POST',
            headers: { authorization: `Bearer ${key}` },
            body: upstream,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            console.error('Transcription failed', data);
            return NextResponse.json(
                { error: data?.error?.message || 'Transcription failed' },
                { status: 502 }
            );
        }
        return NextResponse.json({ text: (data.text || '').trim() });
    } catch (error) {
        console.error('Transcription request failed', error);
        return NextResponse.json({ error: 'Could not reach the gateway' }, { status: 502 });
    }
}
