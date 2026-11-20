/**
 * HOS-2390: the accept route took `measurementId` through a hand-written M/RP pattern, so every real
 * catalog id (`amount-floor`, ...) answered 400. The allowed ids now come from WATCH_CATALOG.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WATCH_CATALOG } from '@repo/payments';
import { describe, expect, it } from 'vitest';
import { ProviderWatchMeasurementIdSchema } from '../../../src/utils/provider-watch/provider-watch-measurement-id.js';

describe('ProviderWatchMeasurementIdSchema', () => {
    it('has catalog entries to check (a vacuous it.each would pass with none)', () => {
        expect(WATCH_CATALOG.length).toBeGreaterThan(0);
    });

    it.each(WATCH_CATALOG.map((entry) => entry.id))('accepts the catalog id %s', (id) => {
        expect(ProviderWatchMeasurementIdSchema.safeParse(id).success).toBe(true);
    });

    it('accepts amount-floor, the id the staging review could not accept', () => {
        expect(ProviderWatchMeasurementIdSchema.parse('amount-floor')).toBe('amount-floor');
    });

    it.each([
        'not-in-catalog',
        'M1',
        'RP10',
        '',
        'AMOUNT-FLOOR',
        'amount-floor '
    ])('refuses %j, which is not a catalog id', (id) => {
        expect(ProviderWatchMeasurementIdSchema.safeParse(id).success).toBe(false);
    });
});

describe('the accept route validates its path id against the catalog', () => {
    const source = readFileSync(
        resolve(import.meta.dirname, '../../../src/routes/provider-watch/admin/index.ts'),
        'utf8'
    );

    it('uses the catalog-derived schema and no hand-written M/RP pattern', () => {
        expect(source).toContain(
            'requestParams: { measurementId: ProviderWatchMeasurementIdSchema }'
        );
        expect(source).not.toContain('M|RP');
    });
});
