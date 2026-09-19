'use client';

import { effortLabel, groupGatewayModels } from '@repo/shared/config';
import { Button, Input } from '@repo/ui';
import { useRouter } from 'next/navigation';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';

type AdminUser = {
    id: string;
    email: string;
    isAdmin: boolean;
    isPro: boolean;
    dailyCredits: number | null;
    limit: number;
    used: number;
    remaining: number;
    lastResetDate: string;
    createdAt: string;
    isCurrent?: boolean;
};

type Policy = { mode: string; freeAllowed: boolean; proAllowed: boolean };
type Gateway = { ok: boolean; count?: number; models?: string[]; error?: string };

const api = (path: string, init?: RequestInit) =>
    fetch(path, { credentials: 'include', ...init }).then(async res => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
        return json;
    });

export default function AdminPage() {
    const { push } = useRouter();
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [policies, setPolicies] = useState<Policy[]>([]);
    const [gateway, setGateway] = useState<Gateway | null>(null);
    const [q, setQ] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const policyFamilies = useMemo(
        () => groupGatewayModels(policies.map(policy => policy.mode)),
        [policies]
    );

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [u, p, g] = await Promise.all([
                api(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`),
                api('/api/admin/policies'),
                api('/api/admin/gateway'),
            ]);
            setUsers(u.users);
            setPolicies(p.policies);
            setGateway(g);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, [q]);

    useEffect(() => {
        const t = setTimeout(load, q ? 300 : 0);
        return () => clearTimeout(t);
    }, [load, q]);

    const patchUser = async (id: string, body: Record<string, unknown>) => {
        try {
            await api(`/api/admin/users/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    };

    const deleteUser = async (u: AdminUser) => {
        if (u.isCurrent || !window.confirm(`Delete ${u.email}?`)) return;
        try {
            await api(`/api/admin/users/${u.id}`, { method: 'DELETE' });
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    };

    const setCredits = async (u: AdminUser) => {
        const value = window.prompt(
            `Daily credit limit for ${u.email} (empty = tier default):`,
            u.dailyCredits?.toString() ?? ''
        );
        if (value === null) return;
        const trimmed = value.trim();
        await patchUser(u.id, {
            dailyCredits: trimmed === '' ? null : Math.max(0, parseInt(trimmed, 10) || 0),
        });
    };

    const togglePolicy = async (mode: string, key: 'freeAllowed' | 'proAllowed', value: boolean) => {
        await api('/api/admin/policies', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode, [key]: value }),
        });
        load();
    };

    const logout = async () => {
        await api('/api/auth/logout', { method: 'POST' });
        push('/admin/login');
    };

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Admin</h1>
                <div className="flex gap-2">
                    <Button variant="bordered" onClick={() => push('/chat')}>
                        Open chat
                    </Button>
                    <Button variant="bordered" onClick={logout}>
                        Log out
                    </Button>
                </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <section className="flex flex-col gap-2 rounded-xl border p-4">
                <h2 className="text-base font-semibold">LLM Gateway</h2>
                {!gateway ? (
                    <p className="text-sm text-muted-foreground">Checking...</p>
                ) : gateway.ok ? (
                    <>
                        <p className="text-sm">
                            Connected — {gateway.count} models reachable with the server key.
                        </p>
                        <p className="text-xs text-muted-foreground break-words">
                            {(gateway.models || []).join(', ')}
                        </p>
                    </>
                ) : (
                    <p className="text-sm text-red-500">{gateway.error}</p>
                )}
            </section>

            <section className="flex flex-col gap-3 rounded-xl border p-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold">Users ({users.length})</h2>
                    <div className="w-64">
                        <Input
                            placeholder="Search email..."
                            value={q}
                            onChange={e => setQ(e.target.value)}
                        />
                    </div>
                </div>
                {loading ? (
                    <p className="text-sm text-muted-foreground">Loading...</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="text-muted-foreground border-b text-xs">
                                    <th className="py-2 pr-4">Email</th>
                                    <th className="py-2 pr-4">Tier</th>
                                    <th className="py-2 pr-4">Usage today</th>
                                    <th className="py-2 pr-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.id} className="border-b last:border-0">
                                        <td className="py-2 pr-4">
                                            {u.email}
                                            {u.isAdmin && (
                                                <span className="ml-2 rounded-full bg-black px-2 py-0.5 text-[10px] text-white">
                                                    ADMIN
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-2 pr-4">{u.isPro ? 'Pro' : 'Free'}</td>
                                        <td className="py-2 pr-4">
                                            {u.used}/{u.limit}
                                            {u.dailyCredits !== null && (
                                                <span className="text-muted-foreground"> (custom)</span>
                                            )}
                                        </td>
                                        <td className="flex flex-wrap gap-1 py-2 pr-4">
                                            {u.isCurrent ? (
                                                <span className="text-muted-foreground text-xs">
                                                    Current admin — manage other accounts here
                                                </span>
                                            ) : (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        variant="bordered"
                                                        onClick={() => patchUser(u.id, { isPro: !u.isPro })}
                                                    >
                                                        {u.isPro ? 'Remove Pro' : 'Give Pro'}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="bordered"
                                                        onClick={() => patchUser(u.id, { resetUsage: true })}
                                                    >
                                                        Reset usage
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="bordered"
                                                        onClick={() => setCredits(u)}
                                                    >
                                                        Set credits
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="bordered"
                                                        onClick={() => patchUser(u.id, { isAdmin: !u.isAdmin })}
                                                    >
                                                        {u.isAdmin ? 'Remove admin' : 'Make admin'}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="bordered"
                                                        onClick={() => deleteUser(u)}
                                                    >
                                                        Delete
                                                    </Button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section className="flex flex-col gap-3 rounded-xl border p-4">
                <h2 className="text-base font-semibold">Model access</h2>
                <p className="text-muted-foreground text-sm">
                    Live models fetched from the gateway. Check Free or Pro to control which tier
                    sees each model in Composer.
                </p>
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="text-muted-foreground border-b text-xs">
                            <th className="py-2 pr-4">Gateway model</th>
                            <th className="py-2 pr-4">Free</th>
                            <th className="py-2 pr-4">Pro</th>
                        </tr>
                    </thead>
                    <tbody>
                        {policyFamilies.map(family => (
                            <Fragment key={family.id}>
                                <tr key={`${family.id}-heading`}  className="bg-muted/40">
                                    <td colSpan={3} className="py-2 pr-4 font-medium">
                                        {family.label}
                                        {family.variants.length > 1 && (
                                            <span className="text-muted-foreground ml-2 text-xs font-normal">
                                                {family.variants.length} effort levels
                                            </span>
                                        )}
                                    </td>
                                </tr>
                                {family.variants.map(variant => {
                                    const policy = policies.find(item => item.mode === variant.id);
                                    if (!policy) return null;
                                    return (
                                        <tr key={policy.mode} className="border-b last:border-0">
                                            <td className="py-2 pl-5 pr-4 font-mono text-xs">
                                                {effortLabel(variant.effort)
                                                    ? `${effortLabel(variant.effort)} · `
                                                    : ''}
                                                {variant.id}
                                            </td>
                                            <td className="py-2 pr-4">
                                                <input
                                                    type="checkbox"
                                                    checked={policy.freeAllowed}
                                                    aria-label={`Allow Free access to ${policy.mode}`}
                                                    onChange={e =>
                                                        togglePolicy(
                                                            policy.mode,
                                                            'freeAllowed',
                                                            e.target.checked
                                                        )
                                                    }
                                                />
                                            </td>
                                            <td className="py-2 pr-4">
                                                <input
                                                    type="checkbox"
                                                    checked={policy.proAllowed}
                                                    aria-label={`Allow Pro access to ${policy.mode}`}
                                                    onChange={e =>
                                                        togglePolicy(
                                                            policy.mode,
                                                            'proAllowed',
                                                            e.target.checked
                                                        )
                                                    }
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </Fragment>
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    );
}
