import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { fetchStatus, logout, parseSnapshot } from '@/lib/api';
import type { StatusSnapshot } from '@shared/status';
import { useEffect, useState } from 'react';

interface DashboardProps {
    readonly onLoggedOut: () => void;
}

export function Dashboard({ onLoggedOut }: DashboardProps) {
    const [snapshot, setSnapshot] = useState<StatusSnapshot | undefined>();
    const [stream, setStream] = useState<'streaming' | 'poll'>('streaming');

    useEffect(() => {
        let cancelled = false;
        let source: EventSource | undefined;
        let pollTimer: ReturnType<typeof setInterval> | undefined;

        function apply(next: StatusSnapshot): void {
            if (!cancelled) {
                setSnapshot(next);
            }
        }

        function startPoll(): void {
            setStream('poll');
            void fetchStatus()
                .then(apply)
                .catch(() => {
                    if (!cancelled) {
                        onLoggedOut();
                    }
                });
            pollTimer = setInterval(() => {
                void fetchStatus()
                    .then(apply)
                    .catch(() => {
                        if (!cancelled) {
                            onLoggedOut();
                        }
                    });
            }, 4000);
        }

        source = new EventSource('/api/events');
        source.onmessage = (event: MessageEvent<string>) => {
            try {
                apply(parseSnapshot(event.data));
            } catch {
                startPoll();
            }
        };
        source.onerror = () => {
            source?.close();
            source = undefined;
            startPoll();
        };

        return () => {
            cancelled = true;
            source?.close();
            if (pollTimer !== undefined) {
                clearInterval(pollTimer);
            }
        };
    }, [onLoggedOut]);

    async function onLogout(): Promise<void> {
        await logout();
        onLoggedOut();
    }

    return (
        <main className='mx-auto min-h-screen max-w-7xl px-6 py-8'>
            <header className='mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6'>
                <div>
                    <p className='font-mono text-xs uppercase tracking-[0.28em] text-brass'>
                        tcu-relay
                    </p>
                    <h1 className='mt-1 text-3xl font-medium'>
                        LiveWire Telemetry
                    </h1>
                </div>
                <div className='flex items-center gap-3'>
                    <Badge
                        className={
                            stream === 'streaming'
                                ? 'border-phosphor text-phosphor'
                                : ''
                        }
                    >
                        {stream}
                    </Badge>
                    <Button
                        variant='ghost'
                        onClick={() => {
                            void onLogout();
                        }}
                    >
                        Sign out
                    </Button>
                </div>
            </header>

            {snapshot === undefined ? (
                <p className='font-mono text-mute'>
                    Waiting for first snapshot…
                </p>
            ) : (
                <div className='grid min-w-0 gap-4 sm:grid-cols-3'>
                    <CtechColumn snapshot={snapshot} />
                    <AbrpColumn snapshot={snapshot} />
                    <RelayColumn snapshot={snapshot} />
                </div>
            )}
        </main>
    );
}

function CtechColumn({ snapshot }: { readonly snapshot: StatusSnapshot }) {
    const ctech = snapshot.ctech;
    return (
        <Card>
            <CardTitle>c.technology</CardTitle>
            <Readout
                label='WS'
                value={ctech.wsState}
                accent={ctech.wsState === 'connected'}
            />
            <Readout label='SoC' value={formatNumber(ctech.soc, '%')} />
            <Readout label='Status' value={ctech.vehicleStatus} />
            <Readout label='Parked' value={formatBool(ctech.parked)} />
            <Readout label='Charging' value={formatBool(ctech.charging)} />
            <Readout
                label='GPS'
                value={
                    ctech.latitude !== undefined &&
                    ctech.longitude !== undefined
                        ? `${ctech.latitude.toFixed(5)}, ${ctech.longitude.toFixed(5)}`
                        : undefined
                }
            />
            <Readout label='Last msg' value={formatAge(ctech.lastMessageAt)} />
            <Readout
                label='Token exp'
                value={formatLocalDateTime(ctech.tokenExpiry)}
            />
            <Readout
                label='HD update'
                value={formatLocalDateTime(ctech.hdLastUpdate)}
            />
            <Readout
                label='GPS ts'
                value={formatLocalDateTime(ctech.gpsTimestamp)}
            />
            <Readout label='Parse err' value={ctech.lastParseError} warn />
        </Card>
    );
}

function AbrpColumn({ snapshot }: { readonly snapshot: StatusSnapshot }) {
    const abrp = snapshot.abrp;
    return (
        <Card>
            <CardTitle>ABRP</CardTitle>
            <Readout
                label='Last result'
                value={abrp.lastResult}
                accent={
                    abrp.lastResult === 'ok' || abrp.lastResult === 'dry_run'
                }
            />
            <Readout label='Last send' value={formatAge(abrp.lastSentAt)} />
            <Readout label='Missing' value={abrp.lastMissing} warn />
            <Readout
                label='Backoff'
                value={
                    abrp.backoffMs !== undefined
                        ? `${String(abrp.backoffMs)} ms`
                        : undefined
                }
            />
            <div className='mt-4 border-t border-line pt-4'>
                <p className='mb-2 text-xs uppercase tracking-[0.16em] text-mute'>
                    Last tlm
                </p>
                <pre className='max-h-100 overflow-auto font-mono text-xs leading-5 text-phosphor'>
                    {abrp.lastTlm === undefined
                        ? '—'
                        : JSON.stringify(abrp.lastTlm, null, 2)}
                </pre>
            </div>
        </Card>
    );
}

function RelayColumn({ snapshot }: { readonly snapshot: StatusSnapshot }) {
    return (
        <Card>
            <CardTitle>Relay</CardTitle>
            <Readout label='Vehicle Name' value={snapshot.vehicleName} />
            <Readout label='ID' value={snapshot.vehicleId} wrap />
            <Readout label='Dry run' value={snapshot.dryRun ? 'yes' : 'no'} />
            <Readout
                label='Interval'
                value={`${String(snapshot.sendIntervalMs)} ms`}
            />
            <Readout
                label='Uptime'
                value={`${String(snapshot.uptimeSeconds)} s`}
            />
            <Readout
                label='Started'
                value={formatLocalDateTime(snapshot.startedAt)}
            />
        </Card>
    );
}

function Readout({
    label,
    value,
    accent = false,
    warn = false,
    wrap = false,
}: {
    readonly label: string;
    readonly value: string | undefined;
    readonly accent?: boolean;
    readonly warn?: boolean;
    readonly wrap?: boolean;
}) {
    return (
        <div className='mb-3 flex items-start justify-between gap-4'>
            <span className='shrink-0 text-xs uppercase tracking-[0.14em] text-mute'>
                {label}
            </span>
            <span
                className={`min-w-0 text-right font-mono text-sm ${
                    wrap ? 'flex-1 break-all' : ''
                } ${
                    warn && value !== undefined
                        ? 'text-alert'
                        : accent
                          ? 'text-phosphor'
                          : 'text-paper'
                }`}
            >
                {value ?? '—'}
            </span>
        </div>
    );
}

function formatNumber(
    value: number | undefined,
    suffix: string,
): string | undefined {
    if (value === undefined) {
        return undefined;
    }
    return `${value.toFixed(1)}${suffix}`;
}

function formatBool(value: boolean | undefined): string | undefined {
    if (value === undefined) {
        return undefined;
    }
    return value ? 'yes' : 'no';
}

function formatAge(iso: string | undefined): string | undefined {
    if (iso === undefined) {
        return undefined;
    }
    const ms = Date.now() - Date.parse(iso);
    if (Number.isNaN(ms)) {
        return iso;
    }
    if (ms < 5_000) {
        return 'just now';
    }
    if (ms < 60_000) {
        return `${String(Math.floor(ms / 1000))}s ago`;
    }
    return formatLocalDateTime(iso);
}

const localDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
});

function formatLocalDateTime(iso: string | undefined): string | undefined {
    if (iso === undefined) {
        return undefined;
    }
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) {
        return iso;
    }
    return localDateTimeFormatter.format(ms);
}
