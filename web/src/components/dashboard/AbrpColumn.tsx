import { Readout } from '@/components/dashboard/Readout';
import { Card, CardTitle } from '@/components/ui/card';
import { formatAge } from '@/lib/format';
import type { StatusSnapshot } from '@shared/status';

export function AbrpColumn({ snapshot }: { readonly snapshot: StatusSnapshot }) {
    const abrp = snapshot.abrp;
    const skippedStale = abrp.lastResult === 'skipped_stale';
    return (
        <Card>
            <CardTitle>ABRP</CardTitle>
            <Readout
                label='Last result'
                value={abrp.lastResult}
                accent={
                    abrp.lastResult === 'ok' || abrp.lastResult === 'dry_run'
                }
                warn={skippedStale || abrp.lastResult === 'error'}
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
