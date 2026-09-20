'use client';

import { useChatStore } from '@repo/common/store';
import { Button, cn, toast } from '@repo/ui';
import { IconLoader2, IconMicrophone, IconPlayerStopFilled } from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';

/*
 * Voice input with two engines:
 * 1. The gateway's transcription model (better, any browser) when configured.
 * 2. The browser's own speech recognition, which keeps audio on the device.
 * Whichever is available wins; if neither is, the button hides itself.
 */

type SpeechRecognitionLike = {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    start: () => void;
    stop: () => void;
    abort: () => void;
    onresult: ((event: any) => void) | null;
    onerror: ((event: any) => void) | null;
    onend: (() => void) | null;
};

const getRecognition = (): SpeechRecognitionLike | null => {
    if (typeof window === 'undefined') return null;
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    return Ctor ? (new Ctor() as SpeechRecognitionLike) : null;
};

const canRecord = () =>
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia;

type Engine = 'server' | 'browser' | null;
type Phase = 'idle' | 'listening' | 'transcribing';

export const VoiceInputButton = () => {
    const editor = useChatStore(state => state.editor);
    const isGenerating = useChatStore(state => state.isGenerating);
    const [engine, setEngine] = useState<Engine>(null);
    const [phase, setPhase] = useState<Phase>('idle');

    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    // Text already in the composer when dictation started; speech is appended to it.
    const baseTextRef = useRef('');

    useEffect(() => {
        let cancelled = false;
        const browserEngine = getRecognition() ? 'browser' : null;
        if (!canRecord()) {
            setEngine(browserEngine);
            return;
        }
        fetch('/api/audio/transcribe')
            .then(res => (res.ok ? res.json() : null))
            .catch(() => null)
            .then(data => {
                if (!cancelled) setEngine(data?.enabled ? 'server' : browserEngine);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(
        () => () => {
            recognitionRef.current?.abort();
            recorderRef.current?.stream.getTracks().forEach(track => track.stop());
        },
        []
    );

    const appendText = useCallback(
        (text: string) => {
            if (!editor || !text) return;
            editor.commands.setContent(baseTextRef.current + text);
            editor.commands.focus('end');
        },
        [editor]
    );

    const startBrowser = () => {
        const recognition = getRecognition();
        if (!recognition) return;
        recognition.lang = navigator.language || 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event: any) => {
            let transcript = '';
            for (let i = 0; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            // Interim words are replaced as they firm up, so rewrite the whole draft.
            appendText(transcript.trimStart());
        };
        recognition.onerror = (event: any) => {
            setPhase('idle');
            if (event.error === 'aborted' || event.error === 'no-speech') return;
            toast({
                title: event.error === 'not-allowed' ? 'Microphone blocked' : 'Could not hear you',
                description:
                    event.error === 'not-allowed'
                        ? 'Allow microphone access for this site and try again.'
                        : undefined,
                variant: 'destructive',
            });
        };
        recognition.onend = () => setPhase(p => (p === 'listening' ? 'idle' : p));
        recognition.start();
        recognitionRef.current = recognition;
        setPhase('listening');
    };

    const startServer = async () => {
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
            toast({
                title: 'Microphone blocked',
                description: 'Allow microphone access for this site and try again.',
                variant: 'destructive',
            });
            return;
        }

        const recorder = new MediaRecorder(stream);
        chunksRef.current = [];
        recorder.ondataavailable = event => event.data.size && chunksRef.current.push(event.data);
        recorder.onstop = async () => {
            stream.getTracks().forEach(track => track.stop());
            const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
            if (!blob.size) {
                setPhase('idle');
                return;
            }
            setPhase('transcribing');
            try {
                const body = new FormData();
                body.append('file', blob, 'speech.webm');
                body.append('language', (navigator.language || 'en').slice(0, 2));
                const res = await fetch('/api/audio/transcribe', { method: 'POST', body });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || 'Transcription failed');
                if (data.text) appendText(data.text);
                else toast({ title: 'Nothing was said' });
            } catch (error) {
                // Fall back to the browser engine for the next attempt.
                if (getRecognition()) setEngine('browser');
                toast({
                    title: 'Could not transcribe that',
                    description: error instanceof Error ? error.message : undefined,
                    variant: 'destructive',
                });
            } finally {
                setPhase('idle');
            }
        };
        recorder.start();
        recorderRef.current = recorder;
        setPhase('listening');
    };

    const start = () => {
        if (!editor) return;
        const existing = editor.getText().trim();
        baseTextRef.current = existing ? `${existing} ` : '';
        if (engine === 'server') startServer();
        else startBrowser();
    };

    const stop = () => {
        if (engine === 'server') recorderRef.current?.stop();
        else {
            recognitionRef.current?.stop();
            setPhase('idle');
        }
    };

    if (!engine) return null;

    const listening = phase === 'listening';
    const busy = phase === 'transcribing';

    return (
        <Button
            size={phase === 'idle' ? 'icon-sm' : 'sm'}
            variant={phase === 'idle' ? 'ghost' : 'secondary'}
            rounded="full"
            disabled={isGenerating || busy}
            tooltip={listening ? 'Stop and transcribe' : 'Dictate a message'}
            aria-label={listening ? 'Stop and transcribe' : 'Dictate a message'}
            aria-pressed={listening}
            className={cn('gap-2', listening && 'bg-red-500/10 text-red-500')}
            onClick={() => (listening ? stop() : start())}
        >
            {busy ? (
                <>
                    <IconLoader2 size={13} className="animate-spin" />
                    Transcribing
                </>
            ) : listening ? (
                <>
                    <IconPlayerStopFilled size={12} strokeWidth={2} className="animate-pulse" />
                    Listening
                </>
            ) : (
                <IconMicrophone size={18} strokeWidth={2} className="text-muted-foreground" />
            )}
        </Button>
    );
};
