import { fetchStatus, parseSnapshot } from '@/lib/api';
import type { StatusSnapshot } from '@shared/status';
import { useEffect, useState } from 'react';

export function useStatusStream(onLoggedOut: () => void): {
    readonly snapshot: StatusSnapshot | undefined;
    readonly stream: 'streaming' | 'poll';
} {
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

    return { snapshot, stream };
}
