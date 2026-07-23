/**
 * @file missing-field-labels.ts
 * @description Presentation-only label maps for the `missing` field vocabulary
 * `resolveListingCompleteness` (`@repo/schemas`) and the checkout route's 422
 * response both use (HOS-166 §6.6, §8 point 4/5).
 *
 * These maps are NOT business logic — they never decide whether a listing is
 * complete, only how to render a human-readable checklist label for a given
 * `missing` entry. That is why they live here, web-only, instead of in
 * `@repo/schemas` alongside `resolveListingCompleteness` itself (HOS-166
 * judgment-day R-5 relocated the LOGIC, not the UI copy).
 *
 * @module lib/commerce/missing-field-labels
 */

/**
 * i18n key SUFFIX (under `commerce.owner.checklist.field.*`) for each
 * `missing` entry `resolveListingCompleteness` (local preview or the
 * server's own `missing` array) can produce. Used to render human-readable
 * checklist labels instead of raw field-path strings.
 */
export const MISSING_FIELD_I18N_SUFFIX: Record<string, string> = {
    name: 'name',
    summary: 'summary',
    description: 'description',
    destinationId: 'destinationId',
    ownerId: 'ownerId',
    type: 'type',
    'media.featuredImage': 'featuredImage',
    contactInfo: 'contactInfo',
    openingHours: 'openingHours',
    priceRange: 'priceRange',
    priceFrom: 'priceFrom'
};

/**
 * Spanish fallback label per `missing` entry — passed as `t()`'s fallback arg
 * (`commerce.owner.checklist.field.*` in the i18n catalog) so the checklist
 * still reads as a human label rather than a raw field-path string, even for
 * an unresolved key.
 */
export const MISSING_FIELD_FALLBACK_LABEL: Record<string, string> = {
    name: 'Nombre',
    summary: 'Resumen',
    description: 'Descripción',
    destinationId: 'Ciudad / Destino',
    ownerId: 'Propietario',
    type: 'Categoría',
    'media.featuredImage': 'Foto principal',
    contactInfo: 'Un dato de contacto (teléfono o email)',
    openingHours: 'Horarios de atención',
    priceRange: 'Rango de precios',
    priceFrom: 'Precio'
};
