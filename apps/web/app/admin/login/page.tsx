'use client';

import { Button, Input } from '@repo/ui';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

// Only same-site paths, so ?next= can't bounce users to another site.
const safeNext = (next: string | null) =>
    next && next.startsWith('/') && !next.startsWith('//') ? next : null;

export default function SignInPage() {
    return (
        <Suspense>
            <SignInForm />
        </Suspense>
    );
}

function SignInForm() {
    const next = safeNext(useSearchParams().get('next'));
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const json = await res.json();
            if (!res.ok) {
                setError(json.error || 'Sign in failed');
                return;
            }
            // Full navigation so plan, credits and model list reload for the new session.
            window.location.assign(next ?? (json.user?.isAdmin ? '/admin' : '/chat'));
        } catch {
            setError('Network error, try again');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-xl font-semibold">Sign in</h1>
                    <p className="text-muted-foreground text-sm">
                        Unlock Pro models, more daily credits, and page publishing.
                    </p>
                </div>
                <Input
                    type="email"
                    placeholder="Email"
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                />
                <Input
                    type="password"
                    placeholder="Password"
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                />
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button type="submit" disabled={loading}>
                    {loading ? 'Signing in...' : 'Sign in'}
                </Button>
                <a
                    href={next ?? '/chat'}
                    className="text-muted-foreground text-center text-xs hover:underline"
                >
                    Continue without an account
                </a>
            </form>
        </div>
    );
}
