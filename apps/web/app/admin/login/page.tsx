'use client';

import { Button, Input } from '@repo/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SignInPage() {
    const { push } = useRouter();
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
            push(json.user?.isAdmin ? '/admin' : '/chat');
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
                    <h1 className="text-xl font-semibold">Admin sign in</h1>
                    <p className="text-muted-foreground text-sm">
                        This login is only for the admin dashboard.
                    </p>
                </div>
                <Input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                />
                <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                />
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button type="submit" disabled={loading}>
                    {loading ? 'Signing in...' : 'Sign in'}
                </Button>
                <p className="text-muted-foreground text-xs">
                    Chat is available without an account. Only administrators sign in here.
                </p>
            </form>
        </div>
    );
}
