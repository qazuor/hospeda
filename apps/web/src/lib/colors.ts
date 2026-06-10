/**
 * @file colors.ts
 * @description Color mapping functions for badges and labels across entity types.
 * Returns structured ColorScheme objects with CSS values using design tokens.
 * Values are intended for inline styles (style attribute), not class names.
 */

import { getAccommodationTypeColorScheme, getAccommodationTypeColorTokens } from '@repo/icons';
import { PostCategoryEnum } from '@repo/schemas';

/**
 * Color scheme for badges and labels.
 * All values are valid CSS property values using semantic design tokens.
 * Apply via inline style: `background-color: ${scheme.bg}; color: ${scheme.text}; border-color: ${scheme.border};`
 */
export interface ColorScheme {
    /** CSS background-color value (e.g. 'var(--brand-accent-a15)') */
    readonly bg: string;
    /** CSS color value (e.g. 'var(--brand-accent)') */
    readonly text: string;
    /** CSS border-color value (e.g. 'var(--brand-accent-a30)') */
    readonly border: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Maps short token names to their full CSS custom property names.
 * Tokens that already map 1:1 (e.g. `hospeda-forest` → `--hospeda-forest`)
 * are not listed here since the default pass-through handles them.
 */
const TOKEN_TO_CSS_VAR: Record<string, string> = {
    accent: 'brand-accent',
    primary: 'brand-primary',
    secondary: 'brand-secondary',
    foreground: 'core-foreground',
    card: 'core-card',
    'muted-foreground': 'core-muted-foreground',
    'primary-foreground': 'primary-foreground',
    'info-foreground': 'info-foreground',
    'warning-foreground': 'warning-foreground'
};

/** Resolves a short token name to its full CSS custom property name. */
function resolveToken(token: string): string {
    return TOKEN_TO_CSS_VAR[token] ?? token;
}

/**
 * Creates a ColorScheme from a token name with configurable bg/border opacity.
 *
 * The default opacities (0.15 / 0.30) match the standard pill look used across
 * cards. Pass `bgOpacity` when a denser fill is needed (e.g. glassy badge over
 * a dark image). The border opacity is derived as `bgOpacity * 2` clamped to 1
 * so callers don't need to know about it.
 */
function scheme({
    token,
    textToken,
    bgOpacity = 0.15
}: {
    readonly token: string;
    readonly textToken?: string;
    readonly bgOpacity?: number;
}): ColorScheme {
    const cssToken = resolveToken(token);
    const cssText = resolveToken(textToken ?? token);
    const borderOpacity = Math.min(bgOpacity * 2, 1);
    return {
        bg: `oklch(from var(--${cssToken}) l c h / ${bgOpacity})`,
        text: `var(--${cssText})`,
        border: `oklch(from var(--${cssToken}) l c h / ${borderOpacity})`
    };
}

/**
 * Creates a ColorScheme with a fully-opaque, contrast-safe background derived
 * from the token's hue and chroma but with luminance clamped to ≤ 0.6 so the
 * pill stays clearly visible even on warm/light surfaces. Tokens that are
 * already darker than 0.6 keep their original luminance untouched.
 *
 * Intended for placements where the subtle 0.15 alpha variant is too washed
 * out — e.g. the accommodation detail header on top of --surface-warm.
 */
function schemeSolid({
    token,
    textToken = 'card'
}: {
    readonly token: string;
    readonly textToken?: string;
}): ColorScheme {
    const cssToken = resolveToken(token);
    const cssText = resolveToken(textToken);
    const clampedL = 'min(l, 0.6)';
    return {
        bg: `oklch(from var(--${cssToken}) ${clampedL} c h)`,
        text: `var(--${cssText})`,
        border: `oklch(from var(--${cssToken}) calc(${clampedL} * 0.7) c h)`
    };
}

// ---------------------------------------------------------------------------
// Accommodation
// ---------------------------------------------------------------------------

/**
 * Returns the color scheme for an accommodation type badge.
 *
 * @param params - Object containing the accommodation type string.
 * @returns A ColorScheme with CSS values for bg, text, and border.
 *
 * @example
 * ```ts
 * getAccommodationTypeColor({ type: 'hotel' })
 * // { bg: 'var(--brand-accent-a15)', text: 'var(--brand-accent)', border: 'var(--brand-accent-a30)' }
 * ```
 */
export function getAccommodationTypeColor({ type }: { readonly type: string }): ColorScheme {
    // The per-type token mapping is the single source of truth in `@repo/icons`
    // (shared with apps/admin). Web now uses the SAME `contrast` treatment as
    // admin so a given accommodation type renders identically in both apps:
    // each per-type token (`--accommodation-type-<type>`) is a distinct,
    // saturated hue, and `contrast` derives a legible light fill + dark text
    // from it. This intentionally changes the web badge look (product-owner
    // approved) from the previous translucent 0.15-alpha pill.
    return getAccommodationTypeColorScheme({ type, variant: 'contrast' });
}

/**
 * Returns a SOLID color scheme for an accommodation type badge.
 *
 * Same semantic mapping as `getAccommodationTypeColor` but with fully-opaque
 * background and contrasting text. Use it where the default subtle (0.15
 * alpha) variant disappears against a warm surface — e.g. detail header.
 *
 * @param params - Object containing the accommodation type string.
 * @returns A ColorScheme with solid bg, contrasting text, and matching border.
 */
export function getAccommodationTypeColorSolid({
    type
}: {
    readonly type: string;
}): ColorScheme {
    // Reuse the shared per-type token mapping (SSOT in `@repo/icons`) but keep
    // the solid (fully-opaque, contrast-clamped) rendering local to web. The
    // solid variant intentionally ignores the mapping's `textToken` and uses
    // `schemeSolid`'s default contrasting `card` text.
    const { colorToken } = getAccommodationTypeColorTokens({ type });
    return schemeSolid({ token: colorToken });
}

/**
 * Returns a human-readable display label for an accommodation type using i18n.
 * Normalizes the API value (e.g. `"COUNTRY_HOUSE"`) to the i18n key format
 * (e.g. `"country_house"`) automatically.
 *
 * @param params - Object containing the accommodation type string and a translation function.
 * @returns Localized display label string.
 *
 * @example
 * ```ts
 * const { t } = createTranslations(locale);
 * getAccommodationTypeLabel({ type: 'HOTEL', t }) // 'Hotel'
 * getAccommodationTypeLabel({ type: 'COUNTRY_HOUSE', t }) // 'Casa de Campo'
 * ```
 */
export function getAccommodationTypeLabel({
    type,
    t
}: {
    readonly type: string;
    readonly t: (key: string, fallback?: string) => string;
}): string {
    const normalizedType = type.toLowerCase();
    return t(`common.enums.accommodationType.${normalizedType}`, type);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/**
 * Returns the color scheme for an event category badge.
 * Supports both English API values and Spanish legacy names from seed data.
 *
 * @param params - Object containing the event category string and optional
 *   `bgOpacity` (default 0.15). Pass a higher opacity for glassy badge looks
 *   over images (e.g. 0.85 on featured cards).
 * @returns A ColorScheme with CSS values for bg, text, and border.
 *
 * @example
 * ```ts
 * getEventCategoryColor({ category: 'music' })
 * // { bg: 'var(--brand-accent-a15)', ... }
 *
 * getEventCategoryColor({ category: 'music', bgOpacity: 0.85 })
 * // { bg: 'var(--brand-accent-a85)', ... }
 * ```
 */
export function getEventCategoryColor({
    category,
    bgOpacity
}: {
    readonly category: string;
    readonly bgOpacity?: number;
}): ColorScheme {
    switch (category.toLowerCase()) {
        case 'music':
            return scheme({ token: 'accent', bgOpacity });
        case 'sports':
            return scheme({ token: 'primary', bgOpacity });
        case 'cultural':
        case 'culture':
            return scheme({ token: 'hospeda-sky', textToken: 'hospeda-river', bgOpacity });
        case 'gastronomy':
            return scheme({ token: 'hospeda-forest', bgOpacity });
        case 'festival':
            return scheme({ token: 'hospeda-sky', textToken: 'hospeda-river', bgOpacity });
        case 'wellness':
            return scheme({ token: 'hospeda-river', bgOpacity });
        case 'art':
            return scheme({ token: 'hospeda-sand', textToken: 'foreground', bgOpacity });
        case 'family':
            return scheme({ token: 'info', bgOpacity });
        case 'nature':
            return scheme({ token: 'hospeda-forest', bgOpacity });
        case 'theater':
            return scheme({ token: 'hospeda-river', bgOpacity });
        case 'workshop':
            return scheme({ token: 'hospeda-sand', textToken: 'foreground', bgOpacity });
        case 'other':
            return scheme({ token: 'muted-foreground', bgOpacity });
        default:
            return scheme({ token: 'accent', bgOpacity });
    }
}

// ---------------------------------------------------------------------------
// Posts / Publications
// ---------------------------------------------------------------------------

/** Color mapping keyed by PostCategoryEnum values (UPPERCASE). */
const POST_CATEGORY_COLOR: Readonly<Record<string, ColorScheme>> = {
    [PostCategoryEnum.TOURISM]: scheme({ token: 'primary' }),
    [PostCategoryEnum.TIPS]: scheme({ token: 'accent' }),
    [PostCategoryEnum.GASTRONOMY]: scheme({ token: 'hospeda-forest' }),
    [PostCategoryEnum.CULTURE]: scheme({ token: 'hospeda-river', textToken: 'foreground' }),
    [PostCategoryEnum.NATURE]: scheme({ token: 'hospeda-river' }),
    [PostCategoryEnum.EVENTS]: scheme({ token: 'info' }),
    [PostCategoryEnum.SPORT]: scheme({ token: 'hospeda-sky', textToken: 'hospeda-river' }),
    [PostCategoryEnum.CARNIVAL]: scheme({ token: 'accent' }),
    [PostCategoryEnum.NIGHTLIFE]: scheme({ token: 'hospeda-river' }),
    [PostCategoryEnum.HISTORY]: scheme({ token: 'hospeda-sand', textToken: 'foreground' }),
    [PostCategoryEnum.TRADITIONS]: scheme({ token: 'hospeda-sand', textToken: 'foreground' }),
    [PostCategoryEnum.WELLNESS]: scheme({ token: 'hospeda-forest' }),
    [PostCategoryEnum.FAMILY]: scheme({ token: 'info' }),
    [PostCategoryEnum.ART]: scheme({ token: 'hospeda-sand', textToken: 'foreground' }),
    [PostCategoryEnum.BEACH]: scheme({ token: 'hospeda-sky', textToken: 'hospeda-river' }),
    [PostCategoryEnum.RURAL]: scheme({ token: 'hospeda-forest' }),
    [PostCategoryEnum.FESTIVALS]: scheme({ token: 'accent' }),
    [PostCategoryEnum.GENERAL]: scheme({ token: 'primary' })
};

/**
 * i18n keys for post category labels. Keyed by PostCategoryEnum values.
 * These are looked up via `t()` at render time for proper locale support.
 */
const POST_CATEGORY_I18N_KEY: Readonly<Record<string, string>> = {
    [PostCategoryEnum.TOURISM]: 'blog.categories.tourism',
    [PostCategoryEnum.TIPS]: 'blog.categories.tips',
    [PostCategoryEnum.GASTRONOMY]: 'blog.categories.gastronomy',
    [PostCategoryEnum.CULTURE]: 'blog.categories.culture',
    [PostCategoryEnum.NATURE]: 'blog.categories.nature',
    [PostCategoryEnum.EVENTS]: 'blog.categories.events',
    [PostCategoryEnum.SPORT]: 'blog.categories.sport',
    [PostCategoryEnum.CARNIVAL]: 'blog.categories.carnival',
    [PostCategoryEnum.NIGHTLIFE]: 'blog.categories.nightlife',
    [PostCategoryEnum.HISTORY]: 'blog.categories.history',
    [PostCategoryEnum.TRADITIONS]: 'blog.categories.traditions',
    [PostCategoryEnum.WELLNESS]: 'blog.categories.wellness',
    [PostCategoryEnum.FAMILY]: 'blog.categories.family',
    [PostCategoryEnum.ART]: 'blog.categories.art',
    [PostCategoryEnum.BEACH]: 'blog.categories.beach',
    [PostCategoryEnum.RURAL]: 'blog.categories.rural',
    [PostCategoryEnum.FESTIVALS]: 'blog.categories.festivals',
    [PostCategoryEnum.GENERAL]: 'blog.categories.general'
};

/**
 * Returns the color scheme for a post or publication category badge.
 * Matches against PostCategoryEnum values (UPPERCASE from API).
 *
 * @param params - Object containing the post category string.
 * @returns A ColorScheme with CSS values for bg, text, and border.
 *
 * @example
 * ```ts
 * getPostCategoryColor({ category: 'SPORT' })
 * // { bg: 'var(--hospeda-sky-a15)', ... }
 * ```
 */
export function getPostCategoryColor({ category }: { readonly category: string }): ColorScheme {
    return POST_CATEGORY_COLOR[category] ?? scheme({ token: 'primary' });
}

/**
 * Returns a human-readable display label for a post category using i18n.
 *
 * @param params - Object containing the post category string and a translation function.
 * @returns Localized display label string.
 *
 * @example
 * ```ts
 * const { t } = createTranslations(locale);
 * getPostCategoryLabel({ category: 'GASTRONOMY', t }) // 'Gastronomía' (es) or 'Gastronomy' (en)
 * ```
 */
export function getPostCategoryLabel({
    category,
    t
}: {
    readonly category: string;
    readonly t: (key: string, fallback?: string) => string;
}): string {
    const i18nKey = POST_CATEGORY_I18N_KEY[category];
    if (!i18nKey) return category;
    return t(i18nKey, category);
}

/** Emoji icons per post category for placeholder images. */
const POST_CATEGORY_EMOJI: Readonly<Record<string, string>> = {
    [PostCategoryEnum.TOURISM]: '✈️',
    [PostCategoryEnum.TIPS]: '💡',
    [PostCategoryEnum.GASTRONOMY]: '🍽️',
    [PostCategoryEnum.CULTURE]: '🎭',
    [PostCategoryEnum.NATURE]: '🌿',
    [PostCategoryEnum.EVENTS]: '🎉',
    [PostCategoryEnum.SPORT]: '🏃',
    [PostCategoryEnum.CARNIVAL]: '🎊',
    [PostCategoryEnum.NIGHTLIFE]: '🌙',
    [PostCategoryEnum.HISTORY]: '📜',
    [PostCategoryEnum.TRADITIONS]: '🧉',
    [PostCategoryEnum.WELLNESS]: '🧘',
    [PostCategoryEnum.FAMILY]: '👨‍👩‍👧',
    [PostCategoryEnum.ART]: '🎨',
    [PostCategoryEnum.BEACH]: '🏖️',
    [PostCategoryEnum.RURAL]: '🌾',
    [PostCategoryEnum.FESTIVALS]: '🎶',
    [PostCategoryEnum.GENERAL]: '📰'
};

/**
 * Returns an emoji icon for a post category (used in placeholder images).
 *
 * @param params - Object containing the post category string.
 * @returns Emoji string for the category.
 *
 * @example
 * ```ts
 * getPostCategoryEmoji({ category: 'SPORT' }) // '🏃'
 * ```
 */
export function getPostCategoryEmoji({ category }: { readonly category: string }): string {
    return POST_CATEGORY_EMOJI[category] ?? '📰';
}

// ---------------------------------------------------------------------------
// Badge status (featured, new, trending, promoted, past, cancelled)
// ---------------------------------------------------------------------------

/**
 * Solid color scheme for high-contrast badges (overlays, image corners).
 * Unlike the standard `scheme()` helper which produces translucent bg/border,
 * this creates opaque backgrounds suitable for badges over images or dark areas.
 */
function solidScheme({
    bgToken,
    textToken
}: {
    readonly bgToken: string;
    readonly textToken: string;
}): ColorScheme {
    const cssBg = resolveToken(bgToken);
    const cssText = resolveToken(textToken);
    return {
        bg: `var(--${cssBg})`,
        text: `var(--${cssText})`,
        border: `var(--${cssBg})`
    };
}

/**
 * Returns the color scheme for a status badge (featured, new, trending, etc.).
 * Centralizes all status badge colors so they can be changed in one place.
 *
 * @param params - Object containing the badge status string.
 * @returns A ColorScheme with CSS values for bg, text, and border.
 *
 * @example
 * ```ts
 * getBadgeStatusColor({ status: 'featured' })
 * // { bg: 'var(--brand-accent)', text: 'var(--primary-foreground)', border: 'var(--brand-accent)' }
 * ```
 */
export function getBadgeStatusColor({ status }: { readonly status: string }): ColorScheme {
    switch (status) {
        case 'featured':
            return solidScheme({ bgToken: 'accent', textToken: 'primary-foreground' });
        case 'new':
            return solidScheme({ bgToken: 'hospeda-forest', textToken: 'primary-foreground' });
        case 'trending':
            return solidScheme({ bgToken: 'accent', textToken: 'primary-foreground' });
        case 'promoted':
            return solidScheme({ bgToken: 'primary', textToken: 'primary-foreground' });
        case 'past':
            return {
                bg: 'var(--muted)',
                text: 'var(--core-muted-foreground)',
                border: 'var(--muted)'
            };
        case 'cancelled':
            return scheme({ token: 'destructive' });
        default:
            return solidScheme({ bgToken: 'accent', textToken: 'primary-foreground' });
    }
}

// ---------------------------------------------------------------------------
// Destinations
// ---------------------------------------------------------------------------

/**
 * Returns the fixed color scheme for a destination badge.
 * Destinations share a single unified color scheme across the UI.
 *
 * @returns A ColorScheme with CSS values for bg, text, and border.
 *
 * @example
 * ```ts
 * getDestinationBadgeColor()
 * // { bg: 'var(--brand-primary-a15)', text: 'var(--brand-primary)', border: 'var(--brand-primary-a30)' }
 * ```
 */
export function getDestinationBadgeColor(): ColorScheme {
    return scheme({ token: 'primary' });
}

// ---------------------------------------------------------------------------
// Shared decorative schemes (muted, warm)
// ---------------------------------------------------------------------------

/**
 * Returns the muted color scheme used for secondary tag chips and neutral
 * decorative badges (e.g. tag lists inside ArticleCard/FeaturedArticleCard).
 *
 * @returns A ColorScheme with low-contrast bg/border and muted-foreground text.
 *
 * @example
 * ```ts
 * getMutedColorScheme()
 * // { bg: 'var(--core-muted-foreground-a08)', text: 'var(--core-muted-foreground)', border: 'var(--core-muted-foreground-a20)' }
 * ```
 */
export function getMutedColorScheme(): ColorScheme {
    return {
        bg: 'var(--core-muted-foreground-a08)',
        text: 'var(--core-muted-foreground)',
        border: 'var(--core-muted-foreground-a20)'
    };
}

/**
 * Returns the warm color scheme used for destination chips on post-related
 * cards (e.g. RelatedPostCard), preserving the peach-tinted surface + accent
 * text look.
 *
 * Resolves to the `--brand-accent` token (the canonical accent colour in this
 * app) for foreground so the chip reads correctly in both light and dark mode.
 *
 * @returns A ColorScheme with warm surface bg, accent text, and transparent border.
 *
 * @example
 * ```ts
 * getWarmColorScheme()
 * // { bg: 'var(--surface-warm)', text: 'var(--brand-accent)', border: 'transparent' }
 * ```
 */
export function getWarmColorScheme(): ColorScheme {
    return {
        bg: 'var(--surface-warm)',
        text: 'var(--brand-accent)',
        border: 'transparent'
    };
}
