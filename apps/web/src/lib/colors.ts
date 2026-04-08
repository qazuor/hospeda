/**
 * @file colors.ts
 * @description Color mapping functions for badges and labels across entity types.
 * Returns structured ColorScheme objects with CSS values using design tokens.
 * Values are intended for inline styles (style attribute), not class names.
 */

import { PostCategoryEnum } from '@repo/schemas';

/**
 * Color scheme for badges and labels.
 * All values are valid CSS property values using semantic design tokens.
 * Apply via inline style: `background-color: ${scheme.bg}; color: ${scheme.text}; border-color: ${scheme.border};`
 */
export interface ColorScheme {
    /** CSS background-color value (e.g. 'oklch(from var(--brand-accent) l c h / 0.15)') */
    readonly bg: string;
    /** CSS color value (e.g. 'var(--brand-accent)') */
    readonly text: string;
    /** CSS border-color value (e.g. 'oklch(from var(--brand-accent) l c h / 0.30)') */
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

/** Creates a ColorScheme from a token name with standard bg/border opacity */
function scheme({
    token,
    textToken
}: {
    readonly token: string;
    readonly textToken?: string;
}): ColorScheme {
    const cssToken = resolveToken(token);
    const cssText = resolveToken(textToken ?? token);
    return {
        bg: `oklch(from var(--${cssToken}) l c h / 0.15)`,
        text: `var(--${cssText})`,
        border: `oklch(from var(--${cssToken}) l c h / 0.30)`
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
 * // { bg: 'oklch(from var(--brand-accent) l c h / 0.15)', text: 'var(--brand-accent)', border: 'oklch(from var(--brand-accent) l c h / 0.30)' }
 * ```
 */
export function getAccommodationTypeColor({ type }: { readonly type: string }): ColorScheme {
    switch (type) {
        case 'hotel':
            return scheme({ token: 'accent' });
        case 'cabin':
            return scheme({ token: 'hospeda-forest' });
        case 'camping':
            return scheme({ token: 'hospeda-sand', textToken: 'foreground' });
        case 'apartment':
            return scheme({ token: 'primary' });
        case 'country_house':
            return scheme({ token: 'secondary' });
        case 'hostel':
            return scheme({ token: 'hospeda-river', textToken: 'card' });
        case 'resort':
            return scheme({ token: 'hospeda-sky' });
        case 'house':
            return scheme({ token: 'muted', textToken: 'foreground' });
        case 'motel':
            return scheme({ token: 'warning', textToken: 'warning-foreground' });
        case 'room':
            return scheme({ token: 'info', textToken: 'info-foreground' });
        default:
            return scheme({ token: 'accent' });
    }
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/**
 * Returns the color scheme for an event category badge.
 * Supports both English API values and Spanish legacy names from seed data.
 *
 * @param params - Object containing the event category string.
 * @returns A ColorScheme with CSS values for bg, text, and border.
 *
 * @example
 * ```ts
 * getEventCategoryColor({ category: 'music' })
 * // { bg: 'oklch(from var(--brand-accent) l c h / 0.15)', text: 'var(--brand-accent)', border: 'oklch(from var(--brand-accent) l c h / 0.30)' }
 * ```
 */
export function getEventCategoryColor({ category }: { readonly category: string }): ColorScheme {
    switch (category.toLowerCase()) {
        case 'music':
            return scheme({ token: 'accent' });
        case 'sports':
            return scheme({ token: 'primary' });
        case 'cultural':
        case 'culture':
            return scheme({ token: 'hospeda-sky' });
        case 'gastronomy':
            return scheme({ token: 'hospeda-forest' });
        case 'festival':
            return scheme({ token: 'hospeda-sky' });
        case 'wellness':
            return scheme({ token: 'hospeda-river', textToken: 'card' });
        case 'art':
            return scheme({ token: 'hospeda-sand', textToken: 'foreground' });
        case 'family':
            return scheme({ token: 'info', textToken: 'info-foreground' });
        case 'nature':
            return scheme({ token: 'hospeda-forest' });
        case 'theater':
            return scheme({ token: 'hospeda-river', textToken: 'card' });
        case 'workshop':
            return scheme({ token: 'hospeda-sand', textToken: 'foreground' });
        case 'other':
            return scheme({ token: 'muted-foreground' });
        default:
            return scheme({ token: 'accent' });
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
    [PostCategoryEnum.NATURE]: scheme({ token: 'hospeda-river', textToken: 'card' }),
    [PostCategoryEnum.EVENTS]: scheme({ token: 'info', textToken: 'info-foreground' }),
    [PostCategoryEnum.SPORT]: scheme({ token: 'hospeda-sky' }),
    [PostCategoryEnum.CARNIVAL]: scheme({ token: 'accent' }),
    [PostCategoryEnum.NIGHTLIFE]: scheme({ token: 'hospeda-river', textToken: 'card' }),
    [PostCategoryEnum.HISTORY]: scheme({ token: 'hospeda-sand', textToken: 'foreground' }),
    [PostCategoryEnum.TRADITIONS]: scheme({ token: 'hospeda-sand', textToken: 'foreground' }),
    [PostCategoryEnum.WELLNESS]: scheme({ token: 'hospeda-forest' }),
    [PostCategoryEnum.FAMILY]: scheme({ token: 'info', textToken: 'info-foreground' }),
    [PostCategoryEnum.ART]: scheme({ token: 'hospeda-sand', textToken: 'foreground' }),
    [PostCategoryEnum.BEACH]: scheme({ token: 'hospeda-sky' }),
    [PostCategoryEnum.RURAL]: scheme({ token: 'hospeda-forest' }),
    [PostCategoryEnum.FESTIVALS]: scheme({ token: 'accent' }),
    [PostCategoryEnum.GENERAL]: scheme({ token: 'primary' })
};

/** Display labels for post categories. Keyed by PostCategoryEnum values. */
const POST_CATEGORY_LABEL: Readonly<Record<string, string>> = {
    [PostCategoryEnum.TOURISM]: 'Turismo',
    [PostCategoryEnum.TIPS]: 'Consejos',
    [PostCategoryEnum.GASTRONOMY]: 'Gastronomía',
    [PostCategoryEnum.CULTURE]: 'Cultura',
    [PostCategoryEnum.NATURE]: 'Naturaleza',
    [PostCategoryEnum.EVENTS]: 'Eventos',
    [PostCategoryEnum.SPORT]: 'Deportes',
    [PostCategoryEnum.CARNIVAL]: 'Carnaval',
    [PostCategoryEnum.NIGHTLIFE]: 'Noche',
    [PostCategoryEnum.HISTORY]: 'Historia',
    [PostCategoryEnum.TRADITIONS]: 'Tradiciones',
    [PostCategoryEnum.WELLNESS]: 'Bienestar',
    [PostCategoryEnum.FAMILY]: 'Familia',
    [PostCategoryEnum.ART]: 'Arte',
    [PostCategoryEnum.BEACH]: 'Playa',
    [PostCategoryEnum.RURAL]: 'Rural',
    [PostCategoryEnum.FESTIVALS]: 'Festivales',
    [PostCategoryEnum.GENERAL]: 'General'
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
 * // { bg: 'oklch(from var(--hospeda-sky) l c h / 0.15)', ... }
 * ```
 */
export function getPostCategoryColor({ category }: { readonly category: string }): ColorScheme {
    return POST_CATEGORY_COLOR[category] ?? scheme({ token: 'primary' });
}

/**
 * Returns a human-readable display label for a post category.
 *
 * @param params - Object containing the post category string (PostCategoryEnum value).
 * @returns Display label string (e.g. 'Deportes' for 'SPORT').
 *
 * @example
 * ```ts
 * getPostCategoryLabel({ category: 'GASTRONOMY' }) // 'Gastronomía'
 * ```
 */
export function getPostCategoryLabel({ category }: { readonly category: string }): string {
    return POST_CATEGORY_LABEL[category] ?? category;
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
 * // { bg: 'oklch(from var(--brand-primary) l c h / 0.15)', text: 'var(--brand-primary)', border: 'oklch(from var(--brand-primary) l c h / 0.30)' }
 * ```
 */
export function getDestinationBadgeColor(): ColorScheme {
    return scheme({ token: 'primary' });
}
