/**
 * venue nightInfo server rules — unit tests (HOS-1846 / TEST:4.2:4, AC:4:7).
 *
 * Pure helper only: no DB, no service instance. Each case feeds the body and
 * the stored-row subset the rules read, and pins `now` so the assertion about
 * the freshness stamp is exact.
 */

import { ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { resolveVenueNightInfoPatch } from '../../../src/services/venue/venue.night-info';
import { ServiceError } from '../../../src/types';

const NOW = new Date('2026-11-04T12:00:00.000Z');
const OLD_DATE = new Date('2026-01-01T00:00:00.000Z');

describe('resolveVenueNightInfoPatch', () => {
    it('returns no patch when the body does not mention the section', () => {
        expect(resolveVenueNightInfoPatch({ body: { name: 'x' }, now: NOW })).toEqual({});
    });

    it('stamps the date when the price changes', () => {
        const patch = resolveVenueNightInfoPatch({
            body: { entryPriceFrom: 7000 },
            current: { entryKind: 'paid', entryPriceFrom: 5000, entryPriceUpdatedAt: OLD_DATE },
            now: NOW
        });
        expect(patch).toEqual({ entryPriceFrom: 7000, entryPriceUpdatedAt: NOW });
    });

    it('does not move the date when the same price is re-sent', () => {
        const patch = resolveVenueNightInfoPatch({
            body: { entryPriceFrom: 5000 },
            current: { entryKind: 'paid', entryPriceFrom: 5000, entryPriceUpdatedAt: OLD_DATE },
            now: NOW
        });
        expect(patch).toEqual({});
    });

    it('stamps the date on create when a price is present', () => {
        const patch = resolveVenueNightInfoPatch({
            body: { entryKind: 'paid', entryPriceFrom: 5000 },
            current: null,
            now: NOW
        });
        expect(patch).toEqual({ entryPriceFrom: 5000, entryPriceUpdatedAt: NOW });
    });

    it('erases price and date when the entry leaves paid', () => {
        const patch = resolveVenueNightInfoPatch({
            body: { entryKind: 'free' },
            current: { entryKind: 'paid', entryPriceFrom: 5000, entryPriceUpdatedAt: OLD_DATE },
            now: NOW
        });
        expect(patch).toEqual({ entryPriceFrom: null, entryPriceUpdatedAt: null });
    });

    it('erases the date when the price is deleted while still paid', () => {
        const patch = resolveVenueNightInfoPatch({
            body: { entryPriceFrom: null },
            current: { entryKind: 'paid', entryPriceFrom: 5000, entryPriceUpdatedAt: OLD_DATE },
            now: NOW
        });
        expect(patch).toEqual({ entryPriceFrom: null, entryPriceUpdatedAt: null });
    });

    it('rejects a price when the resulting kind is varies', () => {
        const run = () =>
            resolveVenueNightInfoPatch({
                body: { entryKind: 'varies', entryPriceFrom: 1000 },
                current: { entryKind: 'paid', entryPriceFrom: 5000, entryPriceUpdatedAt: OLD_DATE },
                now: NOW
            });
        expect(run).toThrow(ServiceError);
        try {
            run();
        } catch (error) {
            expect((error as ServiceError).code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        }
    });

    it('rejects a price against a stored non-paid kind when the body omits entryKind', () => {
        const run = () =>
            resolveVenueNightInfoPatch({
                body: { entryPriceFrom: 1000 },
                current: { entryKind: 'free', entryPriceFrom: null },
                now: NOW
            });
        expect(run).toThrow(ServiceError);
    });

    it('leaves paid state untouched for an unrelated minAge edit', () => {
        const patch = resolveVenueNightInfoPatch({
            body: { minAge: 18 },
            current: { entryKind: 'paid', entryPriceFrom: 5000, entryPriceUpdatedAt: OLD_DATE },
            now: NOW
        });
        expect(patch).toEqual({});
    });
});
