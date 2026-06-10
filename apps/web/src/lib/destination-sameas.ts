/**
 * @file destination-sameas.ts
 * @description Curated map of destination slugs to canonical external entity
 * URLs (schema.org `sameAs`) for entity disambiguation in TouristDestination
 * structured data.
 *
 * INTERIM SOLUTION — this hardcoded map is a stopgap. The durable home for this
 * datum is the destination record itself in the database (e.g. a `wikidataUrl`
 * / `sameAs` field surfaced by the public API). Once that exists, this map
 * should be removed and the page should read the value straight from the API
 * response. Until then, this covers the main Entre Ríos tourist destinations.
 *
 * Every URL below was manually verified to resolve (HTTP 200) on the Spanish
 * Wikipedia at authoring time. Keep entries keyed by the destination `slug` as
 * returned by the public destinations API. Pure module — no runtime APIs, no
 * side-effects — so it is safe to import anywhere (including at build time).
 */

/**
 * Destination slug → array of canonical external entity URLs.
 *
 * Slugs match the public API (`GET /api/v1/public/destinations`). Values use
 * Spanish Wikipedia article URLs. Wikidata Q-ids are intentionally omitted
 * because they were not individually verified; Wikipedia-only `sameAs` is a
 * valid, lower-risk disambiguation signal.
 */
export const DESTINATION_SAMEAS: Record<string, readonly string[]> = {
    'concepcion-del-uruguay': ['https://es.wikipedia.org/wiki/Concepción_del_Uruguay'],
    colon: ['https://es.wikipedia.org/wiki/Colón_(Entre_Ríos)'],
    gualeguaychu: ['https://es.wikipedia.org/wiki/Gualeguaychú'],
    concordia: ['https://es.wikipedia.org/wiki/Concordia_(Argentina)'],
    federacion: ['https://es.wikipedia.org/wiki/Federación_(Entre_Ríos)'],
    chajari: ['https://es.wikipedia.org/wiki/Chajarí'],
    gualeguay: ['https://es.wikipedia.org/wiki/Gualeguay'],
    'san-jose': ['https://es.wikipedia.org/wiki/San_José_(Entre_Ríos)'],
    'villa-elisa': ['https://es.wikipedia.org/wiki/Villa_Elisa_(Entre_Ríos)'],
    villaguay: ['https://es.wikipedia.org/wiki/Villaguay'],
    'san-salvador': ['https://es.wikipedia.org/wiki/San_Salvador_(Entre_Ríos)'],
    'rosario-del-tala': ['https://es.wikipedia.org/wiki/Rosario_del_Tala'],
    urdinarrain: ['https://es.wikipedia.org/wiki/Urdinarrain'],
    larroque: ['https://es.wikipedia.org/wiki/Larroque'],
    caseros: ['https://es.wikipedia.org/wiki/Caseros_(Entre_Ríos)'],
    'pueblo-liebig': ['https://es.wikipedia.org/wiki/Pueblo_Liebig'],
    'santa-ana': ['https://es.wikipedia.org/wiki/Santa_Ana_(Entre_Ríos)'],
    ceibas: ['https://es.wikipedia.org/wiki/Ceibas'],
    ibicuy: ['https://es.wikipedia.org/wiki/Ibicuy'],
    'villa-paranacito': ['https://es.wikipedia.org/wiki/Villa_Paranacito'],
    'san-justo': ['https://es.wikipedia.org/wiki/San_Justo_(Entre_Ríos)'],
    ubajay: ['https://es.wikipedia.org/wiki/Ubajay'],
    'entre-rios': ['https://es.wikipedia.org/wiki/Provincia_de_Entre_Ríos']
};

/** Parameters for {@link getDestinationSameAs}. */
interface GetDestinationSameAsParams {
    /** Destination slug as returned by the public destinations API. */
    readonly slug: string;
}

/**
 * Look up the curated external entity URLs for a destination slug.
 *
 * @param params - The destination slug to resolve.
 * @returns The array of `sameAs` URLs for the slug, or `undefined` when the
 * slug is empty or has no curated entry.
 */
export function getDestinationSameAs(
    params: GetDestinationSameAsParams
): readonly string[] | undefined {
    const { slug } = params;
    if (!slug) return undefined;
    return DESTINATION_SAMEAS[slug];
}
