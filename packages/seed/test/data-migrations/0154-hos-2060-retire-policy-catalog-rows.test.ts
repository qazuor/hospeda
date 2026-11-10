/**
 * @fileoverview
 * Unit tests for `0154-hos-2060-retire-policy-catalog-rows` (HOS-2060): the
 * meta contract and the fixed retirement lists. The SQL is covered by the
 * companion `.integration.test.ts`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0154-hos-2060-retire-policy-catalog-rows.js';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '../../src');

describe('0154-hos-2060-retire-policy-catalog-rows meta', () => {
    it('is a required, destructive migration that needs the policies columns', () => {
        expect(migration.meta.name).toBe('0154-hos-2060-retire-policy-catalog-rows');
        expect(migration.meta.group).toBe('required');
        expect(migration.meta.destructive).toBe(true);
        expect(migration.meta.requiresColumns).toEqual([
            { table: 'accommodations', column: 'policies' },
            { table: 'venues', column: 'policies' },
            { table: 'experiences', column: 'policies' }
        ]);
    });

    it('retires exactly the owner-approved nine rows', () => {
        expect([...migration.RETIRED_POLICY_AMENITY_SLUGS]).toEqual([
            'pet_friendly',
            'smoke_free',
            'accepts_cards',
            'private_events'
        ]);
        expect([...migration.RETIRED_POLICY_FEATURE_SLUGS]).toEqual([
            'pet_suitable',
            'pet_friendly_area',
            'autonomous_checkin',
            'minimum_stay_required',
            'smoking_area'
        ]);
    });
});

describe('baseline dual-write (HOS-25)', () => {
    const slugsIn = (kind: 'amenity' | 'feature'): readonly string[] =>
        readdirSync(join(SRC, 'data', kind))
            .filter((file) => file.endsWith('.json'))
            .map(
                (file) =>
                    (
                        JSON.parse(readFileSync(join(SRC, 'data', kind, file), 'utf-8')) as {
                            slug: string;
                        }
                    ).slug
            );
    const manifest = readFileSync(join(SRC, 'manifest-required.json'), 'utf-8');

    it('the baseline no longer seeds a retired amenity', () => {
        const slugs = slugsIn('amenity');
        expect(slugs.length).toBeGreaterThan(0);
        for (const slug of migration.RETIRED_POLICY_AMENITY_SLUGS)
            expect(slugs).not.toContain(slug);
    });

    it('the baseline no longer seeds a retired feature', () => {
        const slugs = slugsIn('feature');
        expect(slugs.length).toBeGreaterThan(0);
        for (const slug of migration.RETIRED_POLICY_FEATURE_SLUGS)
            expect(slugs).not.toContain(slug);
    });

    it('the manifest names none of the retired fixtures', () => {
        for (const slug of [
            ...migration.RETIRED_POLICY_AMENITY_SLUGS,
            ...migration.RETIRED_POLICY_FEATURE_SLUGS
        ]) {
            expect(manifest).not.toMatch(new RegExp(`-${slug.replaceAll('_', '[-_]')}\\.json`));
        }
    });
});
