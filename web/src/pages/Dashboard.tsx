import { AbrpColumn } from '@/components/dashboard/AbrpColumn';
import { CtechColumn } from '@/components/dashboard/CtechColumn';
import { RelayColumn } from '@/components/dashboard/RelayColumn';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useStatusStream } from '@/hooks/useStatusStream';
import { logout } from '@/lib/api';

interface DashboardProps {
    readonly onLoggedOut: () => void;
}

export function Dashboard({ onLoggedOut }: DashboardProps) {
    const { snapshot, stream } = useStatusStream(onLoggedOut);

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
