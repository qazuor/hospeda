import { type MarketDay, marketCalendarDay, marketMidnight } from './market-time';

function occurrence(year: number, month: number, anchorDay: number): MarketDay {
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { year, month, day: Math.min(anchorDay, last) };
}

/** Next anchor-day occurrence strictly after the market calendar day of opening. */
export function computeWindowClose(input: { readonly anchor: Date; readonly opensAt: Date }): Date {
    const anchorDay = marketCalendarDay(input.anchor).day;
    const opens = marketCalendarDay(input.opensAt);
    let candidate = occurrence(opens.year, opens.month, anchorDay);
    if (candidate.day <= opens.day) {
        const next = new Date(Date.UTC(opens.year, opens.month, 1));
        candidate = occurrence(next.getUTCFullYear(), next.getUTCMonth() + 1, anchorDay);
    }
    return marketMidnight(candidate);
}
