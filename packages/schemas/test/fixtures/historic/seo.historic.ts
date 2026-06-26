/**
 * Historic SEO shape fixtures for the additive-only schema compatibility
 * policy. See `packages/schemas/docs/guides/schema-compat-policy.md`.
 *
 * These fixtures MUST continue to parse against the current `SeoSchema`
 * export in `@repo/schemas/common/seo.schema`. If a change causes any of
 * these to fail, the change is breaking.
 *
 * SPEC-267 removed `keywords` from `SeoSchema`. The `.strip()` call on the
 * schema ensures that legacy payloads carrying `keywords` still parse without
 * error — the extra key is silently dropped.
 */

/** Pre-SPEC-267 SEO payload that includes the now-removed `keywords` field. */
export const seoPreSpec267WithKeywords = {
    title: 'Casa del Río — Alojamiento frente al río',
    description: 'Alquiler temporal a 50m de la costanera. Cochera, parrilla, wifi y jardín.',
    keywords: ['alojamiento', 'concepcion del uruguay', 'rio']
} as const;

/** Pre-SPEC-267 SEO payload with keywords and no title override. */
export const seoPreSpec267KeywordsOnly = {
    keywords: ['turismo', 'hospedaje']
} as const;

/** Post-SPEC-267 minimal valid SEO payload (title only). */
export const seoPostSpec267TitleOnly = {
    title: 'Turismo en el Litoral — Concepción del Uruguay'
} as const;

/** Post-SPEC-267 full SEO payload. */
export const seoPostSpec267Full = {
    title: 'Turismo en el Litoral — Concepción del Uruguay',
    description: 'Descubrí los mejores alojamientos del litoral argentino. Reservá online.'
} as const;
