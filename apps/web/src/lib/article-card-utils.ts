/**
 * @file article-card-utils.ts
 * @description Shared utility functions for article card variants
 * (FeaturedArticleCard, ArticleCard).
 *
 * All functions follow the RO-RO pattern and are pure (no side effects).
 */

import type { ArticleRelatedEntity } from '@/data/types';
import type { SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported article card variant names. */
export type ArticleCardVariant = 'featured' | 'standard';

/** Maximum excerpt length per variant. */
const EXCERPT_LIMITS: Readonly<Record<ArticleCardVariant, number>> = {
    featured: 200,
    standard: 120
} as const;

/** Route prefixes per entity type. */
const ENTITY_ROUTE_PREFIX: Readonly<Record<ArticleRelatedEntity['type'], string>> = {
    destination: 'destinos',
    accommodation: 'alojamientos',
    event: 'eventos'
} as const;

/** Localized reading time suffixes. */
const READING_TIME_SUFFIX: Readonly<Record<SupportedLocale, string>> = {
    es: 'min de lectura',
    en: 'min read',
    pt: 'min de leitura'
} as const;

// ---------------------------------------------------------------------------
// truncateTags
// ---------------------------------------------------------------------------

/** Input for {@link truncateTags}. */
interface TruncateTagsInput {
    /** Full list of tag strings. */
    readonly tags: readonly string[];
    /** Maximum number of visible tags. Defaults to 3. */
    readonly maxVisible?: number;
}

/** Output of {@link truncateTags}. */
interface TruncateTagsResult {
    /** Tags that should be rendered. */
    readonly visible: readonly string[];
    /** Count of tags that are hidden (shown as "+N"). */
    readonly remaining: number;
}

/**
 * Split a tag list into visible items and a count of extras.
 *
 * @param params - Tags array and optional max visible count.
 * @returns Object with visible tags and remaining count.
 *
 * @example
 * ```ts
 * truncateTags({ tags: ['travel', 'nature', 'tips', 'food', 'culture'] });
 * // { visible: ['travel', 'nature', 'tips'], remaining: 2 }
 * ```
 */
export function truncateTags({ tags, maxVisible = 3 }: TruncateTagsInput): TruncateTagsResult {
    const visible = tags.slice(0, maxVisible);
    const remaining = Math.max(0, tags.length - maxVisible);
    return { visible, remaining };
}

// ---------------------------------------------------------------------------
// truncateExcerpt
// ---------------------------------------------------------------------------

/** Input for {@link truncateExcerpt}. */
interface TruncateExcerptInput {
    /** The full excerpt/summary text. */
    readonly text: string;
    /** Card variant determining the character limit. */
    readonly variant: ArticleCardVariant;
}

/** Output of {@link truncateExcerpt}. */
interface TruncateExcerptResult {
    /** The (possibly truncated) excerpt text. */
    readonly text: string;
    /** Whether the text was truncated. */
    readonly wasTruncated: boolean;
}

/**
 * Truncate an article excerpt based on card variant.
 *
 * Limits: featured = 200 chars, standard = 120 chars.
 * Truncation adds an ellipsis and tries to break at the last word boundary.
 *
 * @param params - Text and variant.
 * @returns Object with the truncated text and a flag indicating truncation.
 *
 * @example
 * ```ts
 * truncateExcerpt({ text: 'A very long article summary...', variant: 'standard' });
 * // { text: 'A very long article...', wasTruncated: true }
 * ```
 */
export function truncateExcerpt({ text, variant }: TruncateExcerptInput): TruncateExcerptResult {
    const limit = EXCERPT_LIMITS[variant];

    if (text.length <= limit) {
        return { text, wasTruncated: false };
    }

    // Find last space before the limit to avoid cutting mid-word
    const truncated = text.slice(0, limit);
    const lastSpace = truncated.lastIndexOf(' ');
    const breakPoint = lastSpace > 0 ? lastSpace : limit;

    return {
        text: `${text.slice(0, breakPoint)}...`,
        wasTruncated: true
    };
}

// ---------------------------------------------------------------------------
// resolveEntityLink
// ---------------------------------------------------------------------------

/** Input for {@link resolveEntityLink}. */
interface ResolveEntityLinkInput {
    /** The related entity to link to. */
    readonly entity: ArticleRelatedEntity;
    /** Current locale for URL building. */
    readonly locale: SupportedLocale;
}

/** Output of {@link resolveEntityLink}. */
interface ResolveEntityLinkResult {
    /** Full locale-prefixed href with trailing slash. */
    readonly href: string;
    /** Display label (the entity name). */
    readonly label: string;
}

/**
 * Build a locale-aware link for an article's related entity.
 *
 * Routes: destination -> `/destinos/{slug}/`, accommodation -> `/alojamientos/{slug}/`,
 * event -> `/eventos/{slug}/`.
 *
 * @param params - Entity and locale.
 * @returns Object with href and label.
 *
 * @example
 * ```ts
 * resolveEntityLink({
 *   entity: { type: 'destination', name: 'Colón', slug: 'colon' },
 *   locale: 'es',
 * });
 * // { href: '/es/destinos/colon/', label: 'Colón' }
 * ```
 */
export function resolveEntityLink({
    entity,
    locale
}: ResolveEntityLinkInput): ResolveEntityLinkResult {
    const prefix = ENTITY_ROUTE_PREFIX[entity.type];
    const href = buildUrl({ locale, path: `${prefix}/${entity.slug}` });

    return { href, label: entity.name };
}

// ---------------------------------------------------------------------------
// resolveEntityIcon
// ---------------------------------------------------------------------------

/** Input for {@link resolveEntityIcon}. */
interface ResolveEntityIconInput {
    /** Entity type to map to an icon. */
    readonly type: ArticleRelatedEntity['type'];
}

/** Output of {@link resolveEntityIcon}. */
interface ResolveEntityIconResult {
    /** Emoji/icon prefix representing the entity type. */
    readonly icon: string;
}

/** Icon prefix per entity type. */
const ENTITY_ICON: Readonly<Record<ArticleRelatedEntity['type'], string>> = {
    destination: '📍',
    accommodation: '🏠',
    event: '📅'
} as const;

/**
 * Resolve an emoji icon prefix for an article's related entity type.
 *
 * @param params - Entity type.
 * @returns Object with the icon string.
 *
 * @example
 * ```ts
 * resolveEntityIcon({ type: 'destination' }); // { icon: '📍' }
 * resolveEntityIcon({ type: 'event' });        // { icon: '📅' }
 * ```
 */
export function resolveEntityIcon({ type }: ResolveEntityIconInput): ResolveEntityIconResult {
    return { icon: ENTITY_ICON[type] };
}

// ---------------------------------------------------------------------------
// formatReadingTime
// ---------------------------------------------------------------------------

/** Input for {@link formatReadingTime}. */
interface FormatReadingTimeInput {
    /** Estimated reading time in minutes. */
    readonly minutes: number;
    /** Locale for the suffix string. */
    readonly locale: SupportedLocale;
}

/** Output of {@link formatReadingTime}. */
interface FormatReadingTimeResult {
    /** Localized reading time string (e.g. "7 min de lectura"). */
    readonly text: string;
}

/**
 * Format a reading time value into a localized string.
 *
 * @param params - Minutes and locale.
 * @returns Object with the formatted text.
 *
 * @example
 * ```ts
 * formatReadingTime({ minutes: 7, locale: 'es' });
 * // { text: '7 min de lectura' }
 *
 * formatReadingTime({ minutes: 3, locale: 'en' });
 * // { text: '3 min read' }
 * ```
 */
export function formatReadingTime({
    minutes,
    locale
}: FormatReadingTimeInput): FormatReadingTimeResult {
    const suffix = READING_TIME_SUFFIX[locale];
    return { text: `${minutes} ${suffix}` };
}
