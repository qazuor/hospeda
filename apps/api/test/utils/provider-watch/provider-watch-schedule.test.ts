import { describe, expect, it } from 'vitest';
import {
    isScheduledTickDue,
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
    it('ticks the sandbox account every week', () => {
        expect(
            isScheduledTickDue({ account: 'sandbox', now: new Date('2026-11-16T10:00:00Z') })
        ).toBe(true);
    });

    it('ticks production only in the first week of the month', () => {
        const due = (iso: string) =>
            isScheduledTickDue({ account: 'production', now: new Date(iso) });
        expect(due('2026-11-02T10:00:00Z')).toBe(true);
        expect(due('2026-11-07T10:00:00Z')).toBe(true);
        expect(due('2026-11-09T10:00:00Z')).toBe(false);
        expect(due('2026-11-30T10:00:00Z')).toBe(false);
    });

    it('reads the day on the market clock, not in UTC', () => {
        // 2026-12-08 01:00 UTC is still 2026-12-07 in Buenos Aires.
        expect(
            isScheduledTickDue({ account: 'production', now: new Date('2026-12-08T01:00:00Z') })
        ).toBe(true);
    });
});
