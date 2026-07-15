import { describe, expect, it } from 'vitest';
import {
    CalendarDisconnectResponseSchema,
    CalendarProviderTokenSchema,
    CalendarSyncResultSchema,
    CalendarSyncStatusListResponseSchema,
    ConnectIcalBodySchema,
    IcalProviderTokenSchema,
    SyncCalendarBodySchema
} from '../accommodation-calendar-sync.http.schema.js';

describe('IcalProviderTokenSchema', () => {
    it('accepts airbnb, booking, and other', () => {
        expect(IcalProviderTokenSchema.safeParse('airbnb').success).toBe(true);
        expect(IcalProviderTokenSchema.safeParse('booking').success).toBe(true);
        expect(IcalProviderTokenSchema.safeParse('other').success).toBe(true);
    });

    it('rejects google (OAuth-only, not an iCal provider)', () => {
        const result = IcalProviderTokenSchema.safeParse('google');
        expect(result.success).toBe(false);
    });

    it('rejects an unknown provider', () => {
        const result = IcalProviderTokenSchema.safeParse('vrbo');
        expect(result.success).toBe(false);
    });
});

describe('CalendarProviderTokenSchema', () => {
    it('accepts all four providers including google', () => {
        for (const token of ['google', 'airbnb', 'booking', 'other']) {
            expect(CalendarProviderTokenSchema.safeParse(token).success).toBe(true);
        }
    });

    it('rejects manual (no connection row exists for it)', () => {
        expect(CalendarProviderTokenSchema.safeParse('manual').success).toBe(false);
    });
});

describe('ConnectIcalBodySchema', () => {
    it('accepts a valid airbnb https feed url', () => {
        const result = ConnectIcalBodySchema.safeParse({
            provider: 'airbnb',
            feedUrl: 'https://www.airbnb.com/calendar/ical/12345.ics?s=abc'
        });
        expect(result.success).toBe(true);
    });

    it('rejects provider=google (OAuth-only, must use connect-google)', () => {
        const result = ConnectIcalBodySchema.safeParse({
            provider: 'google',
            feedUrl: 'https://example.com/cal.ics'
        });
        expect(result.success).toBe(false);
    });

    it('rejects an http:// (non-https) feed url', () => {
        const result = ConnectIcalBodySchema.safeParse({
            provider: 'booking',
            feedUrl: 'http://example.com/cal.ics'
        });
        expect(result.success).toBe(false);
    });

    it('rejects a malformed url', () => {
        const result = ConnectIcalBodySchema.safeParse({
            provider: 'other',
            feedUrl: 'not-a-url'
        });
        expect(result.success).toBe(false);
    });

    it('rejects a missing feedUrl', () => {
        const result = ConnectIcalBodySchema.safeParse({ provider: 'airbnb' });
        expect(result.success).toBe(false);
    });
});

describe('CalendarSyncStatusListResponseSchema', () => {
    it('accepts an empty connections array (host never connected anything)', () => {
        const result = CalendarSyncStatusListResponseSchema.safeParse({ connections: [] });
        expect(result.success).toBe(true);
    });

    it('accepts multiple provider rows', () => {
        const result = CalendarSyncStatusListResponseSchema.safeParse({
            connections: [
                {
                    provider: 'GOOGLE_CALENDAR',
                    connected: true,
                    lastSyncAt: new Date().toISOString(),
                    lastSyncStatus: 'OK',
                    lastErrorMessage: null
                },
                {
                    provider: 'AIRBNB',
                    connected: false,
                    lastSyncAt: null,
                    lastSyncStatus: 'ERROR',
                    lastErrorMessage: 'feed unreachable'
                }
            ]
        });
        expect(result.success).toBe(true);
    });
});

describe('CalendarDisconnectResponseSchema', () => {
    it('accepts disconnected true/false', () => {
        expect(CalendarDisconnectResponseSchema.safeParse({ disconnected: true }).success).toBe(
            true
        );
        expect(CalendarDisconnectResponseSchema.safeParse({ disconnected: false }).success).toBe(
            true
        );
    });
});

describe('SyncCalendarBodySchema', () => {
    it('accepts an omitted provider (defaults handled by the route, not the schema)', () => {
        const result = SyncCalendarBodySchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('accepts an explicit provider', () => {
        const result = SyncCalendarBodySchema.safeParse({ provider: 'booking' });
        expect(result.success).toBe(true);
    });

    it('rejects an unknown provider', () => {
        const result = SyncCalendarBodySchema.safeParse({ provider: 'vrbo' });
        expect(result.success).toBe(false);
    });
});

describe('CalendarSyncResultSchema', () => {
    it('accepts a Google-shaped ok result', () => {
        const result = CalendarSyncResultSchema.safeParse({
            status: 'ok',
            eventsProcessed: 3,
            datesUpserted: 2,
            datesRemoved: 1,
            fullSync: true
        });
        expect(result.success).toBe(true);
    });

    it('accepts an iCal-shaped ok result', () => {
        const result = CalendarSyncResultSchema.safeParse({
            status: 'ok',
            removed: 1,
            inserted: 4
        });
        expect(result.success).toBe(true);
    });

    it('accepts a skipped result', () => {
        const result = CalendarSyncResultSchema.safeParse({
            status: 'skipped',
            reason: 'no-connection'
        });
        expect(result.success).toBe(true);
    });

    it('accepts an error result with an iCal-only kind', () => {
        const result = CalendarSyncResultSchema.safeParse({
            status: 'error',
            kind: 'fetch_error',
            message: 'timed out'
        });
        expect(result.success).toBe(true);
    });

    it('accepts an error result with a Google-only kind', () => {
        const result = CalendarSyncResultSchema.safeParse({
            status: 'error',
            kind: 'terminal',
            message: 'revoked'
        });
        expect(result.success).toBe(true);
    });

    it('rejects an unknown status', () => {
        const result = CalendarSyncResultSchema.safeParse({ status: 'weird' });
        expect(result.success).toBe(false);
    });
});
