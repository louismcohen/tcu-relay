export function formatNumber(
    value: number | undefined,
    suffix: string,
): string | undefined {
    if (value === undefined) {
        return undefined;
    }
    return `${value.toFixed(1)}${suffix}`;
}

export function formatBool(value: boolean | undefined): string | undefined {
    if (value === undefined) {
        return undefined;
    }
    return value ? 'yes' : 'no';
}

export function formatAge(iso: string | undefined): string | undefined {
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

export function formatLocalDateTime(iso: string | undefined): string | undefined {
    if (iso === undefined) {
        return undefined;
    }
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) {
        return iso;
    }
    return localDateTimeFormatter.format(ms);
}
