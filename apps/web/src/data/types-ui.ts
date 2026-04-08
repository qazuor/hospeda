/**
 * @file types-ui.ts
 * @description UI-specific type definitions for reviews, articles, stats,
 * features, homepage config, and partners.
 *
 * Split from types.ts to keep individual files under 500 lines.
 * Re-exported from types.ts for backward compatibility.
 */

import type { SupportedLocale } from '@/lib/i18n';

// ---------------------------------------------------------------------------
// Review and social proof
// ---------------------------------------------------------------------------

/**
 * A single review/testimonial card item.
 *
 * Used in the homepage social proof / reviews section.
 * Unlike accommodation reviews fetched from the API, these are curated
 * editorial quotes stored as mock data.
 */
export interface ReviewCardData {
    /** Unique identifier for this review item. */
    readonly id: string;
    /** The testimonial quote displayed on the card. */
    readonly quote: string;
    /** Star rating given by the reviewer (1-5). */
    readonly rating: number;
    /** Full display name of the reviewer. */
    readonly reviewerName: string;
    /** City and country of origin shown below the name. */
    readonly reviewerOrigin: string;
    /** Optional URL for the reviewer's avatar image. Falls back to initials. */
    readonly reviewerAvatar?: string;
    /** Locale of the review text, used for font and formatting decisions. */
    readonly locale?: SupportedLocale;
    /** Initials fallback when no avatar image is available (e.g. "CR"). */
    readonly initials?: string;
    /** Name of the referenced accommodation or destination. */
    readonly entityName?: string;
    /** Slug of the referenced entity for building detail page links. */
    readonly entitySlug?: string;
    /** Type of the referenced entity. */
    readonly entityType?: 'accommodation' | 'destination';
    /** Verification badge text shown below the reviewer name (e.g. "Huésped verificada"). */
    readonly badge?: string;
    /** Number of ratings shown in parentheses next to the star rating. */
    readonly ratingCount?: number;
    /** Accommodation or destination name shown in the location row at the bottom of the card. */
    readonly location?: string;
    /** ISO date string of when the review was submitted (e.g. "2024-03-15T10:00:00Z"). */
    readonly date?: string;
}

// ---------------------------------------------------------------------------
// Article card variants (bento grid)
// ---------------------------------------------------------------------------

/**
 * Related entity linked from an article card (destination, accommodation, or event).
 */
export interface ArticleRelatedEntity {
    /** Entity type determines the URL prefix. */
    readonly type: 'destination' | 'accommodation' | 'event';
    /** Display name of the related entity. */
    readonly name: string;
    /** URL slug for building the detail page link. */
    readonly slug: string;
}

/**
 * Common base props shared by article card variants
 * (FeaturedArticleCard, ArticleCard).
 */
export interface ArticleCardBaseProps {
    /** URL-safe slug for the article detail page. */
    readonly slug: string;
    /** Display title of the article. */
    readonly title: string;
    /** Short excerpt or summary. */
    readonly summary: string;
    /** Optional featured image URL. Falls back to placeholder when absent. */
    readonly featuredImage?: string;
    /** Article category slug. */
    readonly category: string;
    /** ISO 8601 publish date-time string. */
    readonly publishedAt: string;
    /** Estimated reading time in minutes. */
    readonly readingTimeMinutes: number;
    /** Author display name. */
    readonly authorName: string;
    /** Optional author avatar URL. */
    readonly authorAvatar?: string;
    /** Optional tag slugs (max 3 displayed, rest shown as "+N"). */
    readonly tags?: readonly string[];
    /** Whether this article is featured. */
    readonly isFeatured: boolean;
    /** Whether this article is promoted/sponsored. */
    readonly isPromoted?: boolean;
    /** Optional related entity (destination, accommodation, or event). */
    readonly relatedEntity?: ArticleRelatedEntity;
}

// ---------------------------------------------------------------------------
// Stats and features
// ---------------------------------------------------------------------------

/**
 * A single stat counter item for the homepage statistics strip.
 */
export interface StatItemData {
    /** Phosphor icon name to render alongside the counter. */
    readonly icon: string;
    /** The numeric value displayed (animated count-up). */
    readonly value: number;
    /** i18n key for the stat label (e.g. `'home.stats.accommodations'`). */
    readonly labelKey: string;
}

/**
 * A feature/benefit item for the about or CTA sections.
 */
export interface FeatureItemData {
    /** Phosphor icon name rendered in the feature tile. */
    readonly icon: string;
    /** i18n key for the feature title. */
    readonly titleKey: string;
    /** i18n key for the feature description. */
    readonly descriptionKey: string;
}

// ---------------------------------------------------------------------------
// Homepage configuration
// ---------------------------------------------------------------------------

/**
 * Top-level configuration object for the homepage.
 */
export interface HomepageConfig {
    /** Array of image URLs cycled through the hero carousel. */
    readonly heroImages: readonly string[];
    /** Interval in milliseconds between hero image transitions. */
    readonly heroRotationInterval: number;
    /** Number of accommodation cards shown in the homepage section. */
    readonly accommodationsCount: number;
    /** Number of destination cards shown in the homepage section. */
    readonly destinationsCount: number;
    /** Number of event cards shown in the homepage section. */
    readonly eventsCount: number;
    /** Number of blog post cards shown in the homepage section. */
    readonly postsCount: number;
    /** Number of review cards shown in the reviews carousel. */
    readonly reviewsCount: number;
}

// ---------------------------------------------------------------------------
// Partners / sponsors
// ---------------------------------------------------------------------------

/**
 * Partner or sponsor logo item for the partners strip section.
 */
export interface PartnerData {
    /** Display name of the partner or sponsor (used as `alt` text). */
    readonly name: string;
    /** Root-relative path to the partner's logo image. */
    readonly logoPath: string;
    /** Optional external URL the logo links to. */
    readonly url?: string;
}
