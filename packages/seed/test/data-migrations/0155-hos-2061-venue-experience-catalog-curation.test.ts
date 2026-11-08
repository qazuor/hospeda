/**
 * @fileoverview
 * Unit tests for `0155-hos-2061-venue-experience-catalog-curation` (HOS-2061):
 * the meta contract, the fixed owner-approved lists and the baseline
 * dual-write. The SQL is covered by the companion `.integration.test.ts`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0155-hos-2061-venue-experience-catalog-curation.js';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '../../src');

interface Fixture {
    readonly slug: string;
    readonly applicableVerticals: readonly string[];
    readonly category?: string;
    readonly type?: string;
}

const fixturesIn = (kind: 'amenity' | 'feature'): ReadonlyMap<string, Fixture> =>
    new Map(
        readdirSync(join(SRC, 'data', kind))
            .filter((file) => file.endsWith('.json'))
            .map((file) => {
                const fixture = JSON.parse(
                    readFileSync(join(SRC, 'data', kind, file), 'utf-8')
                ) as Fixture;
                return [fixture.slug, fixture] as const;
            })
    );

describe('0155-hos-2061-venue-experience-catalog-curation meta', () => {
    it('is a required, destructive migration that needs the policies and category columns', () => {
        expect(migration.meta.name).toBe('0155-hos-2061-venue-experience-catalog-curation');
        expect(migration.meta.group).toBe('required');
        expect(migration.meta.destructive).toBe(true);
        expect(migration.meta.requiresColumns).toEqual([
            { table: 'venues', column: 'policies' },
            { table: 'experiences', column: 'policies' },
            { table: 'features', column: 'category' }
        ]);
    });

    it('merges and retires exactly the owner-approved rows', () => {
        expect(migration.CATALOG_MERGES).toEqual([
            {
                source: { kind: 'feature', slug: 'kid_friendly' },
                target: { kind: 'feature', slug: 'family_friendly' }
            },
            {
                source: { kind: 'amenity', slug: 'happy_hour' },
                target: { kind: 'feature', slug: 'happy_hour' }
            }
        ]);
        expect([...migration.RETIRED_POLICY_AMENITY_SLUGS]).toEqual(['accepts_reservations']);
        expect([...migration.RETIRED_POLICY_FEATURE_SLUGS]).toEqual(['private_available']);
    });

    it('never retires tourist_info_available or live_music (owner decision)', () => {
        const touched = [
            ...migration.CATALOG_MERGES.map((merge) => merge.source.slug),
            ...migration.RETIRED_POLICY_AMENITY_SLUGS,
            ...migration.RETIRED_POLICY_FEATURE_SLUGS
        ];
        expect(touched).not.toContain('tourist_info_available');
        expect(touched).not.toContain('live_music');
    });
});

describe('baseline dual-write (HOS-25)', () => {
    const amenityFixtures = fixturesIn('amenity');
    const featureFixtures = fixturesIn('feature');
    const manifest = readFileSync(join(SRC, 'manifest-required.json'), 'utf-8');

    it('no longer seeds a merged or retired row', () => {
        expect(amenityFixtures.size).toBeGreaterThan(0);
        expect(amenityFixtures.has('accepts_reservations')).toBe(false);
        expect(amenityFixtures.has('happy_hour')).toBe(false);
        expect(featureFixtures.has('kid_friendly')).toBe(false);
        expect(featureFixtures.has('private_available')).toBe(false);
    });

    it('seeds happy_hour as an offer-profile feature', () => {
        expect(featureFixtures.get('happy_hour')?.category).toBe('OFFER_PROFILE');
    });

    it('lists every new fixture in the manifest, and no retired one', () => {
        for (const file of [
            ...migration.NEW_AMENITY_FIXTURE_FILES,
            ...migration.NEW_FEATURE_FIXTURE_FILES
        ]) {
            expect(manifest).toContain(`"${file}"`);
        }
        for (const file of [
            '095-amenity-services-accepts-reservations.json',
            '097-amenity-services-happy-hour.json',
            '089-feature-kid_friendly.json',
            '095-feature-private_available.json'
        ]) {
            expect(manifest).not.toContain(`"${file}"`);
        }
    });

    it('carries every widening in the baseline', () => {
        for (const { row, add } of migration.VERTICAL_WIDENINGS) {
            const fixture = (row.kind === 'amenity' ? amenityFixtures : featureFixtures).get(
                row.slug
            );
            for (const vertical of add) {
                expect(fixture?.applicableVerticals, `${row.slug} ${vertical}`).toContain(vertical);
            }
        }
    });
});
