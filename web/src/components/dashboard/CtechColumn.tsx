import { Readout } from '@/components/dashboard/Readout';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { formatAge, formatBool, formatLocalDateTime, formatNumber } from '@/lib/format';
import type { StatusSnapshot } from '@shared/status';
import { useState } from 'react';

export function CtechColumn({
    snapshot,
    onReconnect,
}: {
    readonly snapshot: StatusSnapshot;
    readonly onReconnect: () => Promise<void>;
}) {
    const ctech = snapshot.ctech;
    const live = ctech.wsState === 'connected' && !snapshot.stale;
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | undefined>();

    async function handleReconnect(): Promise<void> {
        setBusy(true);
        setError(undefined);
        try {
            await onReconnect();
        } catch {
            setError('reconnect failed');
        } finally {
            setBusy(false);
        }
    }

    return (
        <Card>
            <CardTitle>c.technology</CardTitle>
            <Readout
                label='WS'
                value={ctech.wsState}
                accent={live}
                warn={snapshot.stale && ctech.wsState === 'connected'}
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
            <Readout
                label='Last msg'
                value={formatAge(ctech.lastMessageAt)}
                warn={snapshot.stale}
            />
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
            <div className='mt-4 border-t border-line pt-4'>
                <Button
                    variant='ghost'
                    className='w-full'
                    disabled={busy}
                    onClick={() => {
                        void handleReconnect();
                    }}
                >
                    {busy ? 'Reconnecting…' : 'Reconnect'}
                </Button>
                {error !== undefined ? (
                    <p className='mt-2 font-mono text-xs text-alert'>{error}</p>
                ) : null}
            </div>
        </Card>
    );
}
