'use client';

import { effortLabel, groupGatewayModels } from '@repo/shared/config';
import {
    Badge,
    Button,
    cn,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    Input,
    Switch,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@repo/ui';
import {
    IconAlertTriangle,
    IconCheck,
    IconDotsVertical,
    IconLogout,
    IconMessage,
    IconRefresh,
    IconSearch,
    IconShieldCheck,
    IconSparkles,
    IconTrash,
    IconUsers,
    IconX,
} from '@tabler/icons-react';
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

const json = (body: unknown): RequestInit => ({
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});

const StatCard = ({
    label,
    value,
    hint,
    icon,
}: {
    label: string;
    value: string | number;
    hint?: string;
    icon: React.ReactNode;
}) => (
    <div className="border-border bg-background flex items-start gap-3 rounded-xl border p-4">
        <span className="bg-tertiary text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
            {icon}
        </span>
        <span className="min-w-0">
            <span className="text-muted-foreground block text-xs font-medium">{label}</span>
            <span className="block text-xl font-semibold leading-tight">{value}</span>
            {hint && <span className="text-muted-foreground block truncate text-xs">{hint}</span>}
        </span>
    </div>
);

const UsageBar = ({ used, limit }: { used: number; limit: number }) => {
    const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
    return (
        <span className="flex items-center gap-2">
            <span className="bg-tertiary h-1.5 w-20 overflow-hidden rounded-full">
                <span
                    className={cn(
                        'block h-full rounded-full',
                        pct >= 90 ? 'bg-destructive' : pct >= 60 ? 'bg-amber-500' : 'bg-emerald-500'
                    )}
                    style={{ width: `${pct}%` }}
                />
            </span>
            <span className="text-muted-foreground text-xs tabular-nums">
                {used}/{limit}
            </span>
        </span>
    );
};

/** Inline credit editor: no browser prompt, and empty means "tier default". */
const CreditEditor = ({
    user,
    onSave,
    onCancel,
}: {
    user: AdminUser;
    onSave: (value: number | null) => void;
    onCancel: () => void;
}) => {
    const [value, setValue] = useState(user.dailyCredits?.toString() ?? '');
    const commit = () => {
        const trimmed = value.trim();
        onSave(trimmed === '' ? null : Math.max(0, parseInt(trimmed, 10) || 0));
    };
    return (
        <span className="flex items-center gap-1">
            <Input
                value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter') commit();
                    if (e.key === 'Escape') onCancel();
                }}
                placeholder="Default"
                inputMode="numeric"
                aria-label={`Daily credits for ${user.email}`}
                className="h-7 w-24 text-xs"
                autoFocus
            />
            <Button size="icon-xs" variant="ghost" aria-label="Save" onClick={commit}>
                <IconCheck size={14} />
            </Button>
            <Button size="icon-xs" variant="ghost" aria-label="Cancel" onClick={onCancel}>
                <IconX size={14} />
            </Button>
        </span>
    );
};

const UserRow = ({
    user,
    onPatch,
    onDelete,
}: {
    user: AdminUser;
    onPatch: (body: Record<string, unknown>) => void;
    onDelete: () => void;
}) => {
    const [editing, setEditing] = useState(false);
    const [confirming, setConfirming] = useState(false);

    return (
        <tr className="border-border hover:bg-secondary/40 border-b last:border-0">
            <td className="py-2.5 pr-4">
                <span className="flex items-center gap-2.5">
                    <span className="bg-tertiary flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold uppercase">
                        {user.email.charAt(0)}
                    </span>
                    <span className="min-w-0">
                        <span className="block truncate font-medium">{user.email}</span>
                        <span className="text-muted-foreground block text-xs">
                            Joined {new Date(user.createdAt).toLocaleDateString()}
                        </span>
                    </span>
                    {user.isCurrent && (
                        <Badge variant="secondary" className="shrink-0">
                            You
                        </Badge>
                    )}
                </span>
            </td>
            <td className="py-2.5 pr-4">
                <span className="flex flex-wrap gap-1">
                    {user.isAdmin && <Badge variant="default">Admin</Badge>}
                    <Badge variant={user.isPro ? 'tertiary' : 'secondary'}>
                        {user.isPro ? 'Pro' : 'Free'}
                    </Badge>
                </span>
            </td>
            <td className="py-2.5 pr-4">
                {editing ? (
                    <CreditEditor
                        user={user}
                        onCancel={() => setEditing(false)}
                        onSave={dailyCredits => {
                            setEditing(false);
                            onPatch({ dailyCredits });
                        }}
                    />
                ) : (
                    <button
                        className="hover:bg-quaternary rounded-md px-1.5 py-1 text-left"
                        title="Set a custom daily limit"
                        onClick={() => setEditing(true)}
                    >
                        <UsageBar used={user.used} limit={user.limit} />
                        {user.dailyCredits !== null && (
                            <span className="text-muted-foreground block text-[11px]">
                                custom limit
                            </span>
                        )}
                    </button>
                )}
            </td>
            <td className="py-2.5">
                <span className="flex items-center justify-end gap-2">
                    <span className="flex items-center gap-1.5">
                        <Switch
                            checked={user.isPro}
                            disabled={user.isCurrent}
                            onCheckedChange={isPro => onPatch({ isPro })}
                            aria-label={`Pro access for ${user.email}`}
                        />
                        <span className="text-muted-foreground hidden text-xs sm:inline">Pro</span>
                    </span>
                    <DropdownMenu onOpenChange={open => !open && setConfirming(false)}>
                        <DropdownMenuTrigger asChild>
                            <Button size="icon-sm" variant="ghost" aria-label="More actions">
                                <IconDotsVertical size={16} />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onSelect={() => onPatch({ resetUsage: true })}>
                                <IconRefresh size={14} />
                                Reset usage today
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setEditing(true)}>
                                <IconSparkles size={14} />
                                Set daily credits
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                disabled={user.isCurrent}
                                onSelect={() => onPatch({ isAdmin: !user.isAdmin })}
                            >
                                <IconShieldCheck size={14} />
                                {user.isAdmin ? 'Remove admin' : 'Make admin'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                disabled={user.isCurrent}
                                className="text-destructive focus:text-destructive"
                                onSelect={e => {
                                    if (!confirming) {
                                        e.preventDefault();
                                        setConfirming(true);
                                        return;
                                    }
                                    onDelete();
                                }}
                            >
                                <IconTrash size={14} />
                                {confirming ? 'Click again to delete' : 'Delete account'}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </span>
            </td>
        </tr>
    );
};

export default function AdminPage() {
    const { push } = useRouter();
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [policies, setPolicies] = useState<Policy[]>([]);
    const [gateway, setGateway] = useState<Gateway | null>(null);
    const [q, setQ] = useState('');
    const [modelQ, setModelQ] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

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
            await api(`/api/admin/users/${id}`, { method: 'PATCH', ...json(body) });
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    };

    const deleteUser = async (user: AdminUser) => {
        try {
            await api(`/api/admin/users/${user.id}`, { method: 'DELETE' });
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    };

    const setPolicy = async (
        modes: string[],
        key: 'freeAllowed' | 'proAllowed',
        value: boolean
    ) => {
        // Optimistic: the switch should not wait for a round trip.
        setPolicies(prev => prev.map(p => (modes.includes(p.mode) ? { ...p, [key]: value } : p)));
        try {
            await Promise.all(
                modes.map(mode =>
                    api('/api/admin/policies', { method: 'PATCH', ...json({ mode, [key]: value }) })
                )
            );
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            load();
        }
    };

    const policyFamilies = useMemo(
        () =>
            groupGatewayModels(
                policies.map(policy => policy.mode),
                undefined,
                {
                    collapseDuplicates: false,
                }
            ),
        [policies]
    );
    const visibleFamilies = useMemo(() => {
        const needle = modelQ.toLowerCase().trim();
        if (!needle) return policyFamilies;
        return policyFamilies.filter(
            f =>
                f.label.toLowerCase().includes(needle) ||
                f.variants.some(v => v.id.toLowerCase().includes(needle))
        );
    }, [policyFamilies, modelQ]);

    const stats = useMemo(
        () => ({
            pro: users.filter(u => u.isPro).length,
            admins: users.filter(u => u.isAdmin).length,
            usedToday: users.reduce((n, u) => n + u.used, 0),
            free: policies.filter(p => p.freeAllowed).length,
            proModels: policies.filter(p => p.proAllowed).length,
        }),
        [users, policies]
    );

    const logout = async () => {
        await api('/api/auth/logout', { method: 'POST' });
        push('/admin/login');
    };

    return (
        <div className="bg-secondary min-h-screen">
            <header className="border-border bg-background/80 sticky top-0 z-10 border-b backdrop-blur">
                <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-6 py-3">
                    <h1 className="text-lg font-semibold">Admin</h1>
                    {gateway && (
                        <span
                            className={cn(
                                'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
                                gateway.ok
                                    ? 'bg-emerald-500/10 text-emerald-600'
                                    : 'bg-destructive/10 text-destructive'
                            )}
                            title={gateway.ok ? undefined : gateway.error}
                        >
                            <span
                                className={cn(
                                    'size-1.5 rounded-full',
                                    gateway.ok ? 'bg-emerald-500' : 'bg-destructive'
                                )}
                            />
                            {gateway.ok ? `Gateway · ${gateway.count} models` : 'Gateway down'}
                        </span>
                    )}
                    <span className="flex-1" />
                    <Button size="sm" variant="ghost" onClick={load} tooltip="Refresh">
                        <IconRefresh size={16} />
                    </Button>
                    <Button size="sm" variant="bordered" onClick={() => push('/chat')}>
                        <IconMessage size={16} />
                        Open chat
                    </Button>
                    <Button size="sm" variant="ghost" onClick={logout} aria-label="Log out">
                        <IconLogout size={16} />
                    </Button>
                </div>
            </header>

            <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-6">
                {error && (
                    <p className="border-destructive/30 bg-destructive/5 text-destructive flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                        <IconAlertTriangle size={16} className="shrink-0" />
                        {error}
                        <button className="ml-auto text-xs underline" onClick={() => setError('')}>
                            Dismiss
                        </button>
                    </p>
                )}

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        label="Users"
                        value={users.length}
                        hint={`${stats.admins} admin${stats.admins === 1 ? '' : 's'}`}
                        icon={<IconUsers size={18} />}
                    />
                    <StatCard
                        label="Pro accounts"
                        value={stats.pro}
                        hint={`${users.length - stats.pro} on free`}
                        icon={<IconSparkles size={18} />}
                    />
                    <StatCard
                        label="Credits used today"
                        value={stats.usedToday}
                        hint="across all accounts"
                        icon={<IconMessage size={18} />}
                    />
                    <StatCard
                        label="Models enabled"
                        value={`${stats.free} free · ${stats.proModels} pro`}
                        hint={`${policies.length} known to the gateway`}
                        icon={<IconShieldCheck size={18} />}
                    />
                </div>

                <Tabs defaultValue="users">
                    <TabsList>
                        <TabsTrigger value="users">Users</TabsTrigger>
                        <TabsTrigger value="models">Model access</TabsTrigger>
                    </TabsList>

                    <TabsContent value="users">
                        <section className="border-border bg-background rounded-xl border">
                            <div className="border-border flex items-center gap-3 border-b px-4 py-3">
                                <h2 className="text-sm font-semibold">Accounts</h2>
                                <span className="flex-1" />
                                <span className="relative w-64 max-w-[55%]">
                                    <IconSearch
                                        size={14}
                                        className="text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2"
                                    />
                                    <Input
                                        placeholder="Search email…"
                                        value={q}
                                        onChange={e => setQ(e.target.value)}
                                        className="h-8 pl-8 text-sm"
                                    />
                                </span>
                            </div>
                            {loading && !users.length ? (
                                <p className="text-muted-foreground p-6 text-sm">Loading…</p>
                            ) : !users.length ? (
                                <p className="text-muted-foreground p-6 text-sm">
                                    No accounts match “{q}”.
                                </p>
                            ) : (
                                <div className="overflow-x-auto px-4 pb-2">
                                    <table className="w-full text-left text-sm">
                                        <thead>
                                            <tr className="text-muted-foreground border-border border-b text-xs">
                                                <th className="py-2 pr-4 font-medium">Account</th>
                                                <th className="py-2 pr-4 font-medium">Tier</th>
                                                <th className="py-2 pr-4 font-medium">
                                                    Usage today
                                                </th>
                                                <th className="py-2 text-right font-medium">
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {users.map(user => (
                                                <UserRow
                                                    key={user.id}
                                                    user={user}
                                                    onPatch={body => patchUser(user.id, body)}
                                                    onDelete={() => deleteUser(user)}
                                                />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    </TabsContent>

                    <TabsContent value="models">
                        <section className="border-border bg-background rounded-xl border">
                            <div className="border-border flex flex-wrap items-center gap-3 border-b px-4 py-3">
                                <div>
                                    <h2 className="text-sm font-semibold">Model access</h2>
                                    <p className="text-muted-foreground text-xs">
                                        Which tier sees each gateway model in the composer.
                                    </p>
                                </div>
                                <span className="flex-1" />
                                <span className="relative w-64 max-w-[55%]">
                                    <IconSearch
                                        size={14}
                                        className="text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2"
                                    />
                                    <Input
                                        placeholder="Filter models…"
                                        value={modelQ}
                                        onChange={e => setModelQ(e.target.value)}
                                        className="h-8 pl-8 text-sm"
                                    />
                                </span>
                            </div>

                            {!visibleFamilies.length ? (
                                <p className="text-muted-foreground p-6 text-sm">
                                    No models match “{modelQ}”.
                                </p>
                            ) : (
                                <div className="flex flex-col divide-y">
                                    {visibleFamilies.map(family => {
                                        const modes = family.variants.map(v => v.id);
                                        const rows = family.variants
                                            .map(v => ({
                                                variant: v,
                                                policy: policies.find(p => p.mode === v.id),
                                            }))
                                            .filter(r => r.policy);
                                        const allFree = rows.every(r => r.policy!.freeAllowed);
                                        const allPro = rows.every(r => r.policy!.proAllowed);
                                        return (
                                            <Fragment key={family.id}>
                                                <div className="flex items-center gap-3 px-4 py-2.5">
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block text-sm font-medium">
                                                            {family.label}
                                                        </span>
                                                        <span className="text-muted-foreground text-xs">
                                                            {family.variants.length > 1
                                                                ? `${family.variants.length} effort levels`
                                                                : family.variants[0]?.id}
                                                        </span>
                                                    </span>
                                                    <span className="flex items-center gap-4">
                                                        <span className="flex items-center gap-2">
                                                            <span className="text-muted-foreground w-8 text-right text-xs">
                                                                Free
                                                            </span>
                                                            <Switch
                                                                checked={allFree}
                                                                aria-label={`Free access to all ${family.label} models`}
                                                                onCheckedChange={v =>
                                                                    setPolicy(
                                                                        modes,
                                                                        'freeAllowed',
                                                                        v
                                                                    )
                                                                }
                                                            />
                                                        </span>
                                                        <span className="flex items-center gap-2">
                                                            <span className="text-muted-foreground w-8 text-right text-xs">
                                                                Pro
                                                            </span>
                                                            <Switch
                                                                checked={allPro}
                                                                aria-label={`Pro access to all ${family.label} models`}
                                                                onCheckedChange={v =>
                                                                    setPolicy(
                                                                        modes,
                                                                        'proAllowed',
                                                                        v
                                                                    )
                                                                }
                                                            />
                                                        </span>
                                                    </span>
                                                </div>
                                                {family.variants.length > 1 &&
                                                    rows.map(({ variant, policy }) => (
                                                        <div
                                                            key={variant.id}
                                                            className="bg-secondary/40 flex items-center gap-3 py-2 pl-8 pr-4"
                                                        >
                                                            <span className="min-w-0 flex-1">
                                                                <span className="block text-xs font-medium">
                                                                    {effortLabel(variant.effort) ||
                                                                        'Default'}
                                                                </span>
                                                                <span className="text-muted-foreground font-mono text-[11px]">
                                                                    {variant.id}
                                                                </span>
                                                            </span>
                                                            <span className="flex items-center gap-4">
                                                                <span className="flex w-[74px] justify-end">
                                                                    <Switch
                                                                        checked={
                                                                            policy!.freeAllowed
                                                                        }
                                                                        aria-label={`Free access to ${variant.id}`}
                                                                        onCheckedChange={v =>
                                                                            setPolicy(
                                                                                [variant.id],
                                                                                'freeAllowed',
                                                                                v
                                                                            )
                                                                        }
                                                                    />
                                                                </span>
                                                                <span className="flex w-[74px] justify-end">
                                                                    <Switch
                                                                        checked={policy!.proAllowed}
                                                                        aria-label={`Pro access to ${variant.id}`}
                                                                        onCheckedChange={v =>
                                                                            setPolicy(
                                                                                [variant.id],
                                                                                'proAllowed',
                                                                                v
                                                                            )
                                                                        }
                                                                    />
                                                                </span>
                                                            </span>
                                                        </div>
                                                    ))}
                                            </Fragment>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}
