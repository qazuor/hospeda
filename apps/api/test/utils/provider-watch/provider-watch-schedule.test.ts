import { describe, expect, it } from 'vitest';
import {
    isScheduledTickDue,
    PROVIDER_WATCH_REQUEST_TIMEOUT_MS,
    PROVIDER_WATCH_RUN_BUDGET_MS,
    PROVIDER_WATCH_RUN_DEADLINE_MS,
    resolveWatchAccount
} from '../../../src/utils/provider-watch/provider-watch-schedule';

describe('resolveWatchAccount', () => {
    it.each([
        ['staging', 'sandbox'],
        ['prod', 'production'],
        [undefined, null]
    ] as const)('maps the environment %s to the account %s', (slugPrefix, account) => {
        expect(resolveWatchAccount({ slugPrefix })).toBe(account);
    });
});

describe('isScheduledTickDue', () => {
    const due = (account: 'sandbox' | 'production', iso: string) =>
        isScheduledTickDue({ account, now: new Date(iso) });

    it('ticks the sandbox account on Mondays only (weekly)', () => {
        expect(due('sandbox', '2026-11-02T10:00:00Z')).toBe(true);
        expect(due('sandbox', '2026-11-09T10:00:00Z')).toBe(true);
        expect(due('sandbox', '2026-11-03T10:00:00Z')).toBe(false);
        expect(due('sandbox', '2026-11-08T10:00:00Z')).toBe(false);
    });

    it('ticks production on the 1st of every month, not on the first Monday', () => {
        expect(due('production', '2026-11-01T10:00:00Z')).toBe(true);
        expect(due('production', '2026-12-01T10:00:00Z')).toBe(true);
        // The first Mondays of those months are not the 1st.
        expect(due('production', '2026-11-02T10:00:00Z')).toBe(false);
        expect(due('production', '2026-11-30T10:00:00Z')).toBe(false);
    });

    it('never leaves a gap between two production runs longer than one month plus one day', () => {
        const days: string[] = [];
        for (let month = 1; month <= 12; month += 1) {
            for (let day = 1; day <= 28; day += 1) {
                const iso = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T10:00:00Z`;
                if (due('production', iso)) days.push(iso.slice(0, 10));
            }
        }
        expect(days).toHaveLength(12);
        const gaps = days.slice(1).map((iso, index) => {
            const previous = days[index] as string;
            return (Date.parse(iso) - Date.parse(previous)) / 86_400_000;
        });
        expect(Math.max(...gaps)).toBeLessThanOrEqual(31);
    });

    it('reads the day on the market clock, not in UTC', () => {
        // 2026-12-01 01:00 UTC is still 2026-11-30 in Buenos Aires: not the 1st yet.
        expect(due('production', '2026-12-01T01:00:00Z')).toBe(false);
        // 2026-11-02 01:00 UTC is Sunday 2026-11-01 in Buenos Aires: the 1st, not Monday.
        expect(due('production', '2026-11-02T01:00:00Z')).toBe(true);
        expect(due('sandbox', '2026-11-02T01:00:00Z')).toBe(false);
    });
});

describe('the stale-run cut-off never reaches a live run', () => {
    it('keeps the budget plus the longest last request under the deadline', () => {
        expect(PROVIDER_WATCH_RUN_BUDGET_MS + PROVIDER_WATCH_REQUEST_TIMEOUT_MS).toBeLessThan(
            PROVIDER_WATCH_RUN_DEADLINE_MS
        );
    });
});
