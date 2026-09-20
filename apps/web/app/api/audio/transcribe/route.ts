import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

/*
 * Transcription proxied to the AI gateway's OpenAI-compatible
 * /audio/transcriptions. Set AI_GATEWAY_TRANSCRIBE_MODEL to the model you
 * configured there (defaults to whisper-1). Without a working model the client
 * falls back to the browser's own speech recognition.
 */
const BASE = process.env.AI_GATEWAY_BASE_URL || 'https://ai-gateway.adityamer.dev/v1';
const MODEL = process.env.AI_GATEWAY_TRANSCRIBE_MODEL || 'whisper-1';
const MAX_BYTES = 25 * 1024 * 1024;

let cachedAvailability: { at: number; enabled: boolean } | null = null;

/** True only when the gateway actually serves the configured model. */
async function isModelLive(key: string) {
    if (cachedAvailability && Date.now() - cachedAvailability.at < 60_000) {
        return cachedAvailability.enabled;
    }
    let enabled = false;
    try {
        const response = await fetch(`${BASE}/models`, {
            headers: { authorization: `Bearer ${key}` },
            cache: 'no-store',
        });
        const data = await response.json().catch(() => ({}));
        enabled = !!(data.data || []).some((model: { id?: string }) => model.id === MODEL);
    } catch {
        enabled = false;
    }
    cachedAvailability = { at: Date.now(), enabled };
    return enabled;
}

export async function GET() {
    // The composer asks whether server transcription is worth trying; when the
    // model is not on the gateway it uses the browser engine instead.
    const key = process.env.AI_GATEWAY_API_KEY;
    return NextResponse.json({
        enabled: key ? await isModelLive(key) : false,
        model: MODEL,
    });
}

export async function POST(request: NextRequest) {
    const key = process.env.AI_GATEWAY_API_KEY;
    if (!key)
        return NextResponse.json({ error: 'Transcription is not configured' }, { status: 503 });

    // Transcription costs money upstream, so it needs an account.
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Sign in to use voice input' }, { status: 401 });

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
    upstream.append('model', MODEL);
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
