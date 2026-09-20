'use client';

import { useChatStore } from '@repo/common/store';
import { Button, cn, toast } from '@repo/ui';
import { IconMicrophone, IconPlayerStopFilled } from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';

/*
 * Dictation using the browser's own speech recognition. The AI gateway has no
 * transcription provider configured, and this keeps audio on the device.
 * Chromium browsers support it; elsewhere the button hides itself.
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

export const VoiceInputButton = () => {
    const editor = useChatStore(state => state.editor);
    const isGenerating = useChatStore(state => state.isGenerating);
    const [supported, setSupported] = useState(false);
    const [listening, setListening] = useState(false);
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    // Text already in the composer when dictation started; speech is appended to it.
    const baseTextRef = useRef('');

    useEffect(() => setSupported(!!getRecognition()), []);

    const stop = useCallback(() => {
        recognitionRef.current?.stop();
        setListening(false);
    }, []);

    useEffect(() => () => recognitionRef.current?.abort(), []);

    const start = () => {
        const recognition = getRecognition();
        if (!recognition || !editor) return;

        recognition.lang = navigator.language || 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;

        const existing = editor.getText().trim();
        baseTextRef.current = existing ? `${existing} ` : '';

        recognition.onresult = (event: any) => {
            let transcript = '';
            for (let i = 0; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            // Interim words are replaced as they firm up, so rewrite the whole draft.
            editor.commands.setContent(baseTextRef.current + transcript.trimStart());
            editor.commands.focus('end');
        };
        recognition.onerror = (event: any) => {
            setListening(false);
            if (event.error === 'aborted' || event.error === 'no-speech') return;
            toast({
                title:
                    event.error === 'not-allowed'
                        ? 'Microphone blocked'
                        : 'Could not hear anything',
                description:
                    event.error === 'not-allowed'
                        ? 'Allow microphone access for this site and try again.'
                        : undefined,
                variant: 'destructive',
            });
        };
        recognition.onend = () => setListening(false);

        try {
            recognition.start();
            recognitionRef.current = recognition;
            setListening(true);
        } catch {
            setListening(false);
        }
    };

    if (!supported) return null;

    return (
        <Button
            size={listening ? 'sm' : 'icon-sm'}
            variant={listening ? 'secondary' : 'ghost'}
            rounded="full"
            disabled={isGenerating}
            tooltip={listening ? 'Stop dictation' : 'Dictate a message'}
            aria-label={listening ? 'Stop dictation' : 'Dictate a message'}
            aria-pressed={listening}
            className={cn('gap-2', listening && 'bg-red-500/10 text-red-500')}
            onClick={() => (listening ? stop() : start())}
        >
            {listening ? (
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
