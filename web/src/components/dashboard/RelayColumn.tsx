import { Readout } from '@/components/dashboard/Readout';
import { Card, CardTitle } from '@/components/ui/card';
import { formatLocalDateTime } from '@/lib/format';
import type { StatusSnapshot } from '@shared/status';

export function RelayColumn({ snapshot }: { readonly snapshot: StatusSnapshot }) {
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
