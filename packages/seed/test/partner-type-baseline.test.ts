/**
 * HOS-2336 -- the partner type catalog baseline and the partner fixtures that
 * reference it.
 *
 * Reads the 5 partner type fixtures and the example partner fixtures off disk
 * and checks: the five seeded types with their es/en/pt names and weights,
 * deterministic ids, the manifest, and that every partner names a seeded type
 * by slug. Also pins the two partner normalizers: the HOS-172 one (used by
 * data-migration 0019, before the catalog exists) keeps writing the legacy
 * enum column only, and the baseline one writes `typeId`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PartnerTypeCreateInputSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { partnerBaselineNormalizer, partnerNormalizer } from '../src/example/partners.seed.js';
import requiredManifest from '../src/manifest-required.json';
import {
    normalizePartnerTypeSeedItem,
    partnerTypeIdFor
} from '../src/required/partnerTypes.seed.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '../src/data');

interface TypeFixture {
    readonly id: string;
    readonly slug: string;
    readonly nameI18n: { readonly es: string; readonly en: string; readonly pt: string };
    readonly displayWeight: number;
}

const readFolder = <T>(folder: string): readonly T[] =>
    readdirSync(join(DATA, folder))
        .filter((file) => file.endsWith('.json'))
        .sort()
        .map((file) => JSON.parse(readFileSync(join(DATA, folder, file), 'utf-8')) as T);

const types = readFolder<TypeFixture>('partnerType');
const partners = readFolder<Record<string, unknown>>('partner');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('HOS-2336 partner type baseline', () => {
    it('ships the five types with their names and weights', () => {
        expect(
            types.map((t) => [t.slug, t.nameI18n.es, t.nameI18n.en, t.nameI18n.pt, t.displayWeight])
        ).toEqual([
            ['business', 'Comercio', 'Business', 'Comércio', 10],
            ['ngo', 'ONG', 'NGO', 'ONG', 20],
            ['institution', 'Institución', 'Institution', 'Instituição', 30],
            ['media', 'Medio', 'Media outlet', 'Meio de comunicação', 40],
            ['person', 'Persona', 'Person', 'Pessoa', 50]
        ]);
    });

    it('registers every fixture file in the required manifest', () => {
        const files = readdirSync(join(DATA, 'partnerType')).sort();
        expect([...requiredManifest.partnerTypes].sort()).toEqual(files);
    });

    it('produces valid create payloads with slug-derived deterministic ids', () => {
        for (const fixture of types) {
            const row = normalizePartnerTypeSeedItem(fixture as unknown as Record<string, unknown>);
            expect(row.id).toBe(partnerTypeIdFor({ slug: fixture.slug }));
            expect(row.id).toMatch(UUID);
            expect('$schema' in row).toBe(false);
            const { id: _id, ...input } = row;
            expect(PartnerTypeCreateInputSchema.safeParse(input).success, fixture.slug).toBe(true);
        }
    });
});

describe('HOS-2336 partner fixtures', () => {
    const seededSlugs = new Set(types.map((t) => t.slug));

    it('names a seeded type by slug in every partner fixture, never the legacy key', () => {
        for (const partner of partners) {
            expect(seededSlugs.has(partner.typeSlug as string), String(partner.name)).toBe(true);
            expect('type' in partner).toBe(false);
        }
    });

    it('keeps the HOS-172 normalizer on the legacy column only (data-migration 0019)', () => {
        const fixture = partners[0] as Record<string, unknown>;

        const row = partnerNormalizer(fixture) as Record<string, unknown>;

        expect(row.type).toBe(fixture.typeSlug);
        expect('typeId' in row).toBe(false);
        expect('typeSlug' in row).toBe(false);
    });

    it('writes typeId (and no legacy type) through the baseline normalizer', () => {
        const fixture = partners[0] as Record<string, unknown>;

        const row = partnerBaselineNormalizer(fixture) as Record<string, unknown>;

        expect(row.typeId).toBe(partnerTypeIdFor({ slug: fixture.typeSlug as string }));
        expect('type' in row).toBe(false);
        expect('typeSlug' in row).toBe(false);
    });
});
