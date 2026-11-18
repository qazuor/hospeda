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

    it.each(['sandbox', 'production'] as const)('ticks %s every day of the year', (account) => {
        const notDue: string[] = [];
        for (
            let ms = Date.parse('2026-01-01T10:00:00Z');
            ms < Date.parse('2027-01-01T10:00:00Z');
            ms += 86_400_000
        ) {
            const iso = new Date(ms).toISOString();
            if (!due(account, iso)) notDue.push(iso.slice(0, 10));
        }
        expect(notDue).toEqual([]);
    });

    it('is due on the days the old weekly and monthly cadences skipped', () => {
        // A Tuesday that is not the 1st: neither old cadence ran on it.
        expect(due('sandbox', '2026-11-03T10:00:00Z')).toBe(true);
        expect(due('production', '2026-11-03T10:00:00Z')).toBe(true);
    });
});

describe('the stale-run cut-off never reaches a live run', () => {
    it('keeps the budget plus the longest last request under the deadline', () => {
        expect(PROVIDER_WATCH_RUN_BUDGET_MS + PROVIDER_WATCH_REQUEST_TIMEOUT_MS).toBeLessThan(
            PROVIDER_WATCH_RUN_DEADLINE_MS
        );
    });
});
