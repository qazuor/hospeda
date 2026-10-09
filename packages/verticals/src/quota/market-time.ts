export const MARKET_TIME_ZONE = 'America/Argentina/Buenos_Aires';

export interface MarketDay {
    readonly year: number;
    readonly month: number;
    readonly day: number;
}

const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: MARKET_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
});

function localParts(instant: Date): MarketDay & { hour: number; minute: number; second: number } {
    const parts = Object.fromEntries(
        formatter.formatToParts(instant).map((part) => [part.type, Number(part.value)])
    );
    return {
        year: parts.year as number,
        month: parts.month as number,
        day: parts.day as number,
        hour: parts.hour as number,
        minute: parts.minute as number,
        second: parts.second as number
    };
}

export function marketCalendarDay(instant: Date): MarketDay {
    const { year, month, day } = localParts(instant);
    return { year, month, day };
}

/** Finds the UTC instant corresponding to market midnight, including historical offset changes. */
export function marketMidnight(day: MarketDay): Date {
    const target = Date.UTC(day.year, day.month - 1, day.day);
    let candidate = target;
    for (let i = 0; i < 4; i += 1) {
        const local = localParts(new Date(candidate));
        const shown = Date.UTC(
            local.year,
            local.month - 1,
            local.day,
            local.hour,
            local.minute,
            local.second
        );
        const difference = target - shown;
        if (difference === 0) break;
        candidate += difference;
    }
    return new Date(candidate);
}
