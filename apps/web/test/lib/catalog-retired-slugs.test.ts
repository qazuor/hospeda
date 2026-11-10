/**
 * @file catalog-retired-slugs.test.ts
 * @description HOS-2059: every retired or renamed catalog slug's public
 * landing answers a 301 to its survivor's landing, in ONE hop, through the
 * same resolver the middleware calls.
 *
 * The table is also checked against the data-migration that retired the rows
 * (`0147-hos-2059-catalog-curation`, read as source text, since the web app
 * does not depend on `@repo/seed`): a merge added there without a redirect
 * here would leave a 404 behind.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    RETIRED_AMENITY_SLUG_TARGETS,
    RETIRED_FEATURE_SLUG_TARGETS,
    resolveRetiredCatalogSlugPath
} from '../../src/lib/catalog-retired-slugs';
import { resolveLegacyRedirectTarget } from '../../src/lib/legacy-redirects';

const MIGRATION = readFileSync(
    resolve(
        __dirname,
        '../../../../packages/seed/src/data-migrations/0147-hos-2059-catalog-curation.ts'
    ),
    'utf8'
);

/** `{ source: amenity('x'), target: feature('y') ... }` pairs declared by the migration. */
const MERGES = [
    ...MIGRATION.matchAll(
        /source: (amenity|feature)\('([a-z0-9_]+)'\),\s+target: (amenity|feature)\('([a-z0-9_]+)'\)/g
    )
].map((match) => ({
    sourceKind: match[1],
    sourceSlug: match[2],
    targetKind: match[3],
    targetSlug: match[4]
}));

const MIGRATION_0154 = readFileSync(
    resolve(
        __dirname,
        '../../../../packages/seed/src/data-migrations/0154-hos-2060-retire-policy-catalog-rows.ts'
    ),
    'utf8'
);

/** The slugs a `RETIRED_POLICY_<KIND>_SLUGS` list of migration 0154 declares. */
const policySlugs = (kind: 'AMENITY' | 'FEATURE'): readonly string[] => {
    const block = MIGRATION_0154.match(
        new RegExp(`RETIRED_POLICY_${kind}_SLUGS[^=]*= \\[([^\\]]*)\\]`)
    )?.[1];
    return [...(block ?? '').matchAll(/'([a-z0-9_]+)'/g)].map((match) => match[1] ?? '');
};
const POLICY_AMENITIES = policySlugs('AMENITY');
const POLICY_FEATURES = policySlugs('FEATURE');

const familyOf = (kind: string | undefined) =>
    kind === 'amenity' ? 'comodidades' : 'caracteristicas';

describe('resolveRetiredCatalogSlugPath', () => {
    it('sends a moved amenity to the feature landing of its survivor', () => {
        expect(
            resolveRetiredCatalogSlugPath({ path: '/es/alojamientos/comodidades/river_view/' })
        ).toBe('/es/alojamientos/caracteristicas/river_view/');
    });

    it('sends a merged feature to the amenity landing of its survivor', () => {
        expect(
            resolveRetiredCatalogSlugPath({
                path: '/en/alojamientos/caracteristicas/wifi_full_property/'
            })
        ).toBe('/en/alojamientos/comodidades/wifi/');
    });

    it('sends the renamed spa_front to balneario_front', () => {
        expect(
            resolveRetiredCatalogSlugPath({ path: '/pt/alojamientos/caracteristicas/spa_front/' })
        ).toBe('/pt/alojamientos/caracteristicas/balneario_front/');
    });

    it('drops a pagination tail: the survivor is a different result set', () => {
        expect(
            resolveRetiredCatalogSlugPath({
                path: '/es/alojamientos/comodidades/shared_kitchen/page/3/'
            })
        ).toBe('/es/alojamientos/comodidades/full_kitchen/');
    });

    it('leaves a live slug alone, including one that lives in the other family', () => {
        expect(
            resolveRetiredCatalogSlugPath({ path: '/es/alojamientos/comodidades/wifi/' })
        ).toBeUndefined();
        // transfer_service is retired as a FEATURE but live as an AMENITY.
        expect(
            resolveRetiredCatalogSlugPath({
                path: '/es/alojamientos/comodidades/transfer_service/'
            })
        ).toBeUndefined();
    });

    it('ignores inherited object keys', () => {
        expect(
            resolveRetiredCatalogSlugPath({ path: '/es/alojamientos/comodidades/constructor/' })
        ).toBeUndefined();
    });

    it('never points a retired slug at another retired slug (one hop)', () => {
        for (const target of [
            ...Object.values(RETIRED_AMENITY_SLUG_TARGETS),
            ...Object.values(RETIRED_FEATURE_SLUG_TARGETS)
        ]) {
            if (target.family === 'search') continue;
            const path = `/es/alojamientos/${target.family}/${target.slug}/`;
            expect(resolveRetiredCatalogSlugPath({ path }), path).toBeUndefined();
        }
    });
});

describe('resolveLegacyRedirectTarget — HOS-2059 retired catalog slugs', () => {
    it('answers a 301 through the middleware resolver', () => {
        expect(
            resolveLegacyRedirectTarget({ path: '/es/alojamientos/comodidades/panoramic_view/' })
        ).toEqual({
            target: '/es/alojamientos/caracteristicas/panoramic_view_extended/',
            status: 301
        });
    });
});

describe('the redirect table matches data-migration 0147', () => {
    it('reads all nineteen merges from the migration', () => {
        expect(MERGES).toHaveLength(19);
    });

    it.each(MERGES)('$sourceKind $sourceSlug redirects to its survivor $targetKind $targetSlug', ({
        sourceKind,
        sourceSlug,
        targetKind,
        targetSlug
    }) => {
        const table =
            sourceKind === 'amenity' ? RETIRED_AMENITY_SLUG_TARGETS : RETIRED_FEATURE_SLUG_TARGETS;
        expect(table[sourceSlug ?? '']).toEqual({
            family: familyOf(targetKind),
            slug: targetSlug
        });
    });

    it('has no redirect the migration does not justify (besides the spa_front rename)', () => {
        const declared = new Set(MERGES.map((merge) => `${merge.sourceKind}:${merge.sourceSlug}`));
        declared.add('feature:spa_front');
        for (const slug of POLICY_AMENITIES) declared.add(`amenity:${slug}`);
        for (const slug of POLICY_FEATURES) declared.add(`feature:${slug}`);
        for (const slug of Object.keys(RETIRED_AMENITY_SLUG_TARGETS)) {
            expect(declared.has(`amenity:${slug}`), slug).toBe(true);
        }
        for (const slug of Object.keys(RETIRED_FEATURE_SLUG_TARGETS)) {
            expect(declared.has(`feature:${slug}`), slug).toBe(true);
        }
    });
});

describe('the redirect table matches data-migration 0154 (HOS-2060)', () => {
    it('reads the four amenities and five features the migration retires', () => {
        expect(POLICY_AMENITIES).toHaveLength(4);
        expect(POLICY_FEATURES).toHaveLength(5);
    });

    it.each([
        ...POLICY_AMENITIES.map((slug) => ['comodidades', slug] as const),
        ...POLICY_FEATURES.map((slug) => ['caracteristicas', slug] as const)
    ])('/%s/%s answers a 301 to the accommodation search', (family, slug) => {
        const redirect = resolveLegacyRedirectTarget({
            path: `/es/alojamientos/${family}/${slug}/`
        });
        expect(redirect?.status).toBe(301);
        expect(redirect?.target.startsWith('/es/alojamientos/')).toBe(true);
        expect(redirect?.target).not.toContain(`/${family}/`);
    });

    it('sends the pets rows to the allowsPets search and the rest to the bare search', () => {
        expect(
            resolveRetiredCatalogSlugPath({ path: '/en/alojamientos/comodidades/pet_friendly/' })
        ).toBe('/en/alojamientos/?allowsPets=true');
        expect(
            resolveRetiredCatalogSlugPath({
                path: '/es/alojamientos/caracteristicas/pet_friendly_area/page/2/'
            })
        ).toBe('/es/alojamientos/?allowsPets=true');
        expect(
            resolveRetiredCatalogSlugPath({ path: '/es/alojamientos/comodidades/accepts_cards/' })
        ).toBe('/es/alojamientos/');
    });
});

const MIGRATION_0155 = readFileSync(
    resolve(
        __dirname,
        '../../../../packages/seed/src/data-migrations/0155-hos-2061-venue-experience-catalog-curation.ts'
    ),
    'utf8'
);

/** Merges and policy retirements declared by migration 0155 (HOS-2061). */
const MERGES_0155 = [
    ...MIGRATION_0155.matchAll(
        /source: (amenity|feature)\('([a-z0-9_]+)'\),\s+target: (amenity|feature)\('([a-z0-9_]+)'\)/g
    )
].map((match) => ({
    sourceKind: match[1],
    sourceSlug: match[2],
    targetKind: match[3],
    targetSlug: match[4]
}));
const policySlugs0155 = (kind: 'AMENITY' | 'FEATURE'): readonly string[] => {
    const block = MIGRATION_0155.match(
        new RegExp(`RETIRED_POLICY_${kind}_SLUGS[^=]*= \\[([^\\]]*)\\]`)
    )?.[1];
    return [...(block ?? '').matchAll(/'([a-z0-9_]+)'/g)].map((match) => match[1] ?? '');
};

describe('data-migration 0155 adds no redirect (HOS-2061)', () => {
    it('reads the two merges and the two policy retirements', () => {
        expect(MERGES_0155).toHaveLength(2);
        expect(policySlugs0155('AMENITY')).toEqual(['accepts_reservations']);
        expect(policySlugs0155('FEATURE')).toEqual(['private_available']);
    });

    it('leaves the four retired rows without a redirect: they never had an accommodation landing', () => {
        // Arrange
        const retired = [
            ...MERGES_0155.map((merge) => `${merge.sourceKind}:${merge.sourceSlug}`),
            ...policySlugs0155('AMENITY').map((slug) => `amenity:${slug}`),
            ...policySlugs0155('FEATURE').map((slug) => `feature:${slug}`)
        ];

        // Act / Assert
        for (const ref of retired) {
            const [kind, slug] = ref.split(':') as [string, string];
            const table =
                kind === 'amenity' ? RETIRED_AMENITY_SLUG_TARGETS : RETIRED_FEATURE_SLUG_TARGETS;
            expect(Object.hasOwn(table, slug), ref).toBe(false);
        }
    });
});

/** Live seed-baseline catalog rows, keyed by slug, with their verticals. */
const baselineVerticals = (kind: 'amenity' | 'feature'): ReadonlyMap<string, readonly string[]> => {
    const dir = resolve(__dirname, `../../../../packages/seed/src/data/${kind}`);
    return new Map(
        readdirSync(dir)
            .filter((file) => file.endsWith('.json'))
            .map((file) => {
                const row = JSON.parse(readFileSync(resolve(dir, file), 'utf8')) as {
                    slug: string;
                    applicableVerticals: readonly string[];
                };
                return [row.slug, row.applicableVerticals] as const;
            })
    );
};

describe('every redirect lands on a live accommodation landing (HOS-2061)', () => {
    const landingRows = {
        comodidades: baselineVerticals('amenity'),
        caracteristicas: baselineVerticals('feature')
    } as const;
    const entries = [
        ...Object.entries(RETIRED_AMENITY_SLUG_TARGETS),
        ...Object.entries(RETIRED_FEATURE_SLUG_TARGETS)
    ];

    it('reads the seed baseline', () => {
        expect(landingRows.comodidades.size).toBeGreaterThan(0);
        expect(landingRows.caracteristicas.size).toBeGreaterThan(0);
    });

    it.each(entries)('%s points at a live, accommodation-applicable row', (_slug, target) => {
        if (target.family === 'search') return;
        const verticals = landingRows[target.family].get(target.slug);
        expect(verticals, `${target.family}/${target.slug} is not a live row`).toBeDefined();
        expect(verticals).toContain('accommodation');
    });
});
