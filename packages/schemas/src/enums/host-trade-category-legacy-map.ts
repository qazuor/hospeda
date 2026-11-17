/**
 * Old `HostTradeCategoryEnum` value to the catalog slug(s) it becomes
 * (HOS-919 spec 5.5). `GAS` maps to installation only; `PILETA_JARDIN` splits
 * in two.
 *
 * Single source of truth for the translation: the seed data-migration
 * (0180) uses it to convert existing providers and leads, and alliance lead
 * provisioning uses it for a lead written by a container that still ran the
 * old code after that migration (rolling deploy), so it carries only the legacy
 * `category` and no `categorySlugs`.
 *
 * @example
 * ```ts
 * LEGACY_CATEGORY_TO_SLUGS.PILETA_JARDIN // ['piletas', 'parque-jardineria']
 * ```
 */
export const LEGACY_CATEGORY_TO_SLUGS: Readonly<Record<string, readonly string[]>> = {
    CERRAJERIA: ['cerrajeria'],
    PLOMERIA: ['plomeria'],
    ELECTRICIDAD: ['electricidad'],
    GAS: ['gas-instalacion'],
    CLIMATIZACION: ['climatizacion'],
    LIMPIEZA: ['limpieza-domicilio'],
    FLETES: ['fletes'],
    VIDRIERIA: ['vidrieria'],
    CARPINTERIA: ['carpinteria'],
    PILETA_JARDIN: ['piletas', 'parque-jardineria'],
    PLAGAS: ['control-plagas'],
    INTERNET: ['internet-tv'],
    ALBANILERIA: ['albanileria']
};
