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
import { readFileSync } from 'node:fs';
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
        for (const slug of Object.keys(RETIRED_AMENITY_SLUG_TARGETS)) {
            expect(declared.has(`amenity:${slug}`), slug).toBe(true);
        }
        for (const slug of Object.keys(RETIRED_FEATURE_SLUG_TARGETS)) {
            expect(declared.has(`feature:${slug}`), slug).toBe(true);
        }
    });
});
