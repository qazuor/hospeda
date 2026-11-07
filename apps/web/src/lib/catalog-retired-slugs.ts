/**
 * @file catalog-retired-slugs.ts
 * @description Where a retired catalog slug's public landing now lives
 * (HOS-2059).
 *
 * The HOS-2059 curation retired nineteen catalog rows into a survivor and
 * renamed one. Each had a public landing, `/{lang}/alojamientos/comodidades/{slug}/`
 * for an amenity or `/{lang}/alojamientos/caracteristicas/{slug}/` for a
 * feature, that would otherwise 404. Some survivors live in the OTHER table
 * (the river view became a feature, the laundry service an amenity), so the
 * target names its family as well as its slug.
 *
 * The data-migration that retired the rows is
 * `packages/seed/src/data-migrations/0147-hos-2059-catalog-curation.ts`
 * (`CATALOG_MERGES`, `FEATURE_SLUG_RENAMES`); this table is its public-URL
 * counterpart, and `legacy-redirects.ts` resolves it as a 301.
 *
 * @module lib/catalog-retired-slugs
 */

/** The two catalog landing families, by their URL segment. */
export type CatalogLandingFamily = 'comodidades' | 'caracteristicas';

/** Where a retired slug's landing redirects to. */
export interface CatalogLandingTarget {
    readonly family: CatalogLandingFamily;
    readonly slug: string;
}

const amenityLanding = (slug: string): CatalogLandingTarget => ({ family: 'comodidades', slug });
const featureLanding = (slug: string): CatalogLandingTarget => ({
    family: 'caracteristicas',
    slug
});

/** Retired AMENITY slugs (`/alojamientos/comodidades/{slug}/`) and their survivor. */
export const RETIRED_AMENITY_SLUG_TARGETS: Readonly<Record<string, CatalogLandingTarget>> = {
    river_view: featureLanding('river_view'),
    river_access: featureLanding('river_access'),
    panoramic_view: featureLanding('panoramic_view_extended'),
    shared_kitchen: amenityLanding('full_kitchen'),
    shared_patio: amenityLanding('patio'),
    umbrella_gazebo: amenityLanding('gazebo')
};

/** Retired or renamed FEATURE slugs (`/alojamientos/caracteristicas/{slug}/`) and their survivor. */
export const RETIRED_FEATURE_SLUG_TARGETS: Readonly<Record<string, CatalogLandingTarget>> = {
    spa_front: featureLanding('balneario_front'),
    laundry_service: amenityLanding('laundry_service'),
    luggage_storage: amenityLanding('luggage_storage'),
    wifi_full_property: amenityLanding('wifi'),
    satellite_wifi: amenityLanding('wifi'),
    internal_parking: amenityLanding('parking'),
    perimeter_lighting: amenityLanding('outdoor_lighting'),
    disability_accessible: amenityLanding('wheelchair_accessible'),
    remote_coworking_suitable: amenityLanding('coworking_space'),
    camping_sector: featureLanding('camping_area'),
    private_grill: amenityLanding('bbq_grill'),
    covered_barbecue_area: amenityLanding('quincho'),
    transfer_service: amenityLanding('transfer_service'),
    vehicle_rental: amenityLanding('vehicle_rental')
};

/**
 * Resolves a catalog landing path whose slug was retired to its survivor's
 * landing.
 *
 * Any tail after the slug (`page/2/`) is dropped: the survivor's listing is a
 * different result set, so a page number from the old one means nothing there.
 *
 * @param input - The request `path` (locale-prefixed).
 * @returns The survivor's landing path, or `undefined` when `path` is not a
 *   catalog landing or its slug is not retired.
 */
export function resolveRetiredCatalogSlugPath({
    path
}: {
    readonly path: string;
}): string | undefined {
    const match = path.match(
        /^\/(es|en|pt)\/alojamientos\/(comodidades|caracteristicas)\/([^/]+)(\/.*)?$/
    );
    if (!match) return undefined;
    const locale = match[1] as string;
    const family = match[2] as CatalogLandingFamily;
    const slug = match[3] as string;
    const table =
        family === 'comodidades' ? RETIRED_AMENITY_SLUG_TARGETS : RETIRED_FEATURE_SLUG_TARGETS;
    const target = Object.hasOwn(table, slug) ? table[slug] : undefined;
    if (!target) return undefined;
    return `/${locale}/alojamientos/${target.family}/${target.slug}/`;
}
