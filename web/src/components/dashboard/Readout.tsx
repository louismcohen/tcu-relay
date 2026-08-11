export function Readout({
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
