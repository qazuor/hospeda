/**
 * @file constants.ts
 * @description Application-wide constants for the Hospeda web app.
 */

/** Brand name used in titles, meta tags, and UI */
export const BRAND_NAME = 'Hospeda';

/**
 * Brand primary color as an sRGB hex string, derived from `--brand-primary`
 * (river[500] = oklch(0.63 0.19 259) converted to sRGB).
 *
 * Used in:
 *  - `<meta name="theme-color">` across all layout shells
 *  - `theme_color` in public/site.webmanifest
 *
 * Single source of truth — do NOT hardcode this hex in layout files.
 *
 * @see packages/design-tokens/src/tokens/colors.ts (river canonical value)
 * @see packages/design-tokens/src/themes/web-light.ts (brand-primary mapping)
 * @see SPEC-157 REQ-18
 */
export const BRAND_THEME_COLOR = '#3885f9' as const;

/** Separator between page title and brand name */
export const TITLE_SEPARATOR = ' | ';

/**
 * Official social profiles for the Hospeda brand. Single source of truth for
 * both `SocialLinks.astro` (rendered footer links) and `OrganizationJsonLd.astro`
 * (schema.org Organization `sameAs`).
 *
 * `platform` keys the icon + accessible label in SocialLinks; `url` is the
 * canonical profile URL. Order here is the render order in the footer.
 */
export const SOCIAL_PROFILES = [
    { platform: 'facebook', url: 'https://www.facebook.com/hospeda.com.ar' },
    { platform: 'instagram', url: 'https://www.instagram.com/hospeda.com.ar' },
    { platform: 'x', url: 'https://x.com/hospeda.com.ar' },
    { platform: 'youtube', url: 'https://www.youtube.com/@hospeda.com.ar' },
    { platform: 'whatsapp', url: 'https://wa.me/543442453797' }
] as const;

/** A social platform key (e.g. for mapping to an icon component). */
export type SocialPlatform = (typeof SOCIAL_PROFILES)[number]['platform'];

/**
 * Brand profile URLs for schema.org Organization `sameAs`. Derived from
 * SOCIAL_PROFILES, excluding WhatsApp — a messaging channel, not a brand
 * profile, so it does not belong in `sameAs`.
 */
export const SOCIAL_PROFILE_URLS: readonly string[] = SOCIAL_PROFILES.filter(
    (profile) => profile.platform !== 'whatsapp'
).map((profile) => profile.url);

/**
 * Canonical organization facts for the Hospeda brand. Single source of truth
 * for the schema.org `Organization` structured data emitted on the homepage
 * (`OrganizationJsonLd.astro`). Enriching the Organization node with contact,
 * address, and area-served data helps search engines and AI assistants answer
 * "what is Hospeda / how do I reach them / where do they operate" questions.
 *
 * `address` maps to schema.org `PostalAddress`; `areaServed` maps to a
 * schema.org `State` contained in a `Country`.
 *
 * @see SPEC-157 REQ-5 (Organization JSON-LD)
 */
export const ORGANIZATION_INFO = {
    /** One-paragraph description of the platform. */
    description:
        'Hospeda es la plataforma para descubrir y reservar alojamientos turísticos en el Litoral de Entre Ríos, Argentina: desde cabañas y casas de campo hasta hoteles, con información turística de la región.',
    /** Public contact phone in E.164-ish format (matches the confirmed number). */
    telephone: '+543442453797',
    /** Public contact email. */
    email: 'info@hospeda.com.ar',
    /** Postal address fields (schema.org PostalAddress). */
    address: {
        streetAddress: 'Ruta Provincial 39, km 142, lote 19',
        addressLocality: 'Concepción del Uruguay',
        addressRegion: 'Entre Ríos',
        postalCode: '3260',
        addressCountry: 'AR'
    },
    /** Geographic area the platform serves (schema.org State → Country). */
    areaServed: {
        name: 'Entre Ríos',
        containedInPlace: { name: 'Argentina' }
    },
    /** Year the organization was founded (ISO 8601 year). */
    foundingDate: '2026'
} as const;
