/**
 * Translating the filter bar into API query params (HOS-376 T-056).
 *
 * The two date fields are the reason this is a module and not an inline object
 * literal: `<input type="date">` yields a bare `YYYY-MM-DD`, which the API
 * coerces to MIDNIGHT. Sent verbatim as an upper bound, "up to August 1st"
 * silently means "up to July 31st at 23:59" and the day the admin is looking
 * for is the one day excluded.
 */
import { describe, expect, it } from 'vitest';
import { buildUsageQueryParams } from '../usage-filter-params';

const EMPTY = {
    status: '',
    declaredBy: '',
    creationChannel: '',
    hostTradeId: '',
    hostUserId: '',
    createdAfter: '',
    createdBefore: ''
} as const;

describe('buildUsageQueryParams', () => {
    it('sends only pagination when nothing is filtered', () => {
        expect(buildUsageQueryParams({ filters: EMPTY, page: 1, pageSize: 25 })).toEqual({
            page: 1,
            pageSize: 25
        });
    });

    it('passes the enum filters through untouched', () => {
        const params = buildUsageQueryParams({
            filters: { ...EMPTY, status: 'REJECTED', creationChannel: 'EMAIL_LOOKUP' },
            page: 2,
            pageSize: 25
        });

        expect(params).toEqual({
            page: 2,
            pageSize: 25,
            status: 'REJECTED',
            creationChannel: 'EMAIL_LOOKUP'
        });
    });

    it('trims an id pasted with surrounding whitespace', () => {
        const params = buildUsageQueryParams({
            filters: { ...EMPTY, hostTradeId: '  ht-1  ' },
            page: 1,
            pageSize: 25
        });

        expect(params.hostTradeId).toBe('ht-1');
    });

    it('drops an id that is nothing but whitespace', () => {
        const params = buildUsageQueryParams({
            filters: { ...EMPTY, hostTradeId: '   ' },
            page: 1,
            pageSize: 25
        });

        expect(params.hostTradeId).toBeUndefined();
    });

    it('sends the lower bound at the start of its day', () => {
        const params = buildUsageQueryParams({
            filters: { ...EMPTY, createdAfter: '2026-08-01' },
            page: 1,
            pageSize: 25
        });

        expect(params.createdAfter).toBe('2026-08-01T00:00:00.000Z');
    });

    /**
     * The whole reason this function exists: the upper bound must cover the day
     * the admin named, not stop where it begins.
     */
    it('extends the upper bound to the end of its day', () => {
        const params = buildUsageQueryParams({
            filters: { ...EMPTY, createdBefore: '2026-08-01' },
            page: 1,
            pageSize: 25
        });

        expect(params.createdBefore).toBe('2026-08-01T23:59:59.999Z');
    });

    it('ignores a malformed date rather than sending something the API rejects', () => {
        const params = buildUsageQueryParams({
            filters: { ...EMPTY, createdAfter: '01/08/2026', createdBefore: 'not-a-date' },
            page: 1,
            pageSize: 25
        });

        expect(params.createdAfter).toBeUndefined();
        expect(params.createdBefore).toBeUndefined();
    });

    it('discards an enum value that is not one of the accepted ones', () => {
        const params = buildUsageQueryParams({
            filters: { ...EMPTY, status: 'ARCHIVED', creationChannel: 'CARRIER_PIGEON' },
            page: 1,
            pageSize: 25
        });

        expect(params.status).toBeUndefined();
        expect(params.creationChannel).toBeUndefined();
    });
});
