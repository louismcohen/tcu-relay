import { Readout } from '@/components/dashboard/Readout';
import { Card, CardTitle } from '@/components/ui/card';
import { formatAge, formatBool, formatLocalDateTime, formatNumber } from '@/lib/format';
import type { StatusSnapshot } from '@shared/status';

export function CtechColumn({ snapshot }: { readonly snapshot: StatusSnapshot }) {
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
