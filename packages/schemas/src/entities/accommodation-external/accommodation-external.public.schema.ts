import { z } from 'zod';
import { ExternalPlatformEnumSchema } from '../../enums/external-platform.schema.js';
import { ExternalReviewSnippetSchema } from './accommodation-external-listing.schema.js';

// ============================================================================
// TTL CONSTANT
// ============================================================================

/**
 * Maximum age (in milliseconds) for cached snippets before they are
 * considered stale and omitted from the public response.
 *
 * 7 days. Consumers that need to override this can pass a custom TTL to
 * {@link buildExternalReputationBlock}.
 */
export const SNIPPETS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ============================================================================
// PER-PLATFORM ITEM SCHEMA
// ============================================================================

/**
 * A single platform's external reputation block as shown on the public
 * accommodation detail page.
 *
 * - `showLink` controls whether the `url` / `deepLink` is surfaced.
 * - `showReviews` controls whether `snippets` are surfaced.
 * - Snippets are ONLY included for Google and ONLY when not TTL-expired.
 */
export const ExternalReputationPlatformItemSchema = z.object({
    /** Platform identifier so the UI can render the correct badge/logo. */
    platform: ExternalPlatformEnumSchema,
    /**
     * Public URL to the external listing. Present only when `showLink` is
     * true on the associated listing row.
     */
    url: z.string().url().nullish(),
    /**
     * Deep link to the reviews section on the external platform. Present only
     * when `showLink` is true.
     */
    deepLink: z.string().url().nullish(),
    /** Overall numeric rating from the external platform. */
    rating: z.number().min(0).max(10).nullish(),
    /** Total review count as reported by the external platform. */
    reviewsCount: z.number().int().min(0).nullish(),
    /**
     * Review snippets. Populated only for GOOGLE and only when the last
     * successful snippet fetch is within the TTL window.
     */
    snippets: z.array(ExternalReviewSnippetSchema).nullish()
});
export type ExternalReputationPlatformItem = z.infer<typeof ExternalReputationPlatformItemSchema>;

// ============================================================================
// AGGREGATE PUBLIC BLOCK SCHEMA
// ============================================================================

/**
 * The complete external reputation block embedded in the public accommodation
 * detail response.
 *
 * Contains one item per platform that has a verified listing with at least one
 * of showLink or showReviews enabled. Platforms that are entirely hidden (both
 * flags false) are omitted from the array.
 */
export const ExternalReputationBlockSchema = z.object({
    /** Per-platform reputation items, in no guaranteed order. */
    items: z.array(ExternalReputationPlatformItemSchema)
});
export type ExternalReputationBlock = z.infer<typeof ExternalReputationBlockSchema>;

// ============================================================================
// BUILD HELPER
// ============================================================================

/**
 * Input shape for {@link buildExternalReputationBlock}.
 */
export interface ExternalReputationSource {
    /** Platform identifier. */
    readonly platform: string;
    /** Public listing URL set by the owner. */
    readonly url: string;
    /** Whether the owner opted to show the external link publicly. */
    readonly showLink: boolean;
    /** Whether the owner opted to show review snippets publicly. */
    readonly showReviews: boolean;
    /** Whether an admin has verified this listing entry. */
    readonly verified: boolean;
    /** Cached aggregate rating. */
    readonly rating: number | string | null | undefined;
    /** Cached total review count. */
    readonly reviewsCount: number | null | undefined;
    /** Deep link to the reviews tab on the external platform. */
    readonly deepLink: string | null | undefined;
    /** Cached review snippets (JSONB). */
    readonly snippets: readonly unknown[] | null | undefined;
    /** Timestamp of last successful snippet fetch. */
    readonly snippetsFetchedAt: Date | string | null | undefined;
}

/**
 * Builds the {@link ExternalReputationBlock} for a public accommodation detail
 * response from raw DB rows.
 *
 * Filtering rules applied:
 * 1. Only verified listings are included.
 * 2. Listings where both `showLink` and `showReviews` are false are omitted.
 * 3. `url` and `deepLink` are only included when `showLink` is true.
 * 4. `snippets` are only included when `showReviews` is true AND the platform
 *    is GOOGLE AND the `snippetsFetchedAt` timestamp is within `ttlMs`.
 *
 * @param sources - Raw DB rows joining listing + reputation data.
 * @param ttlMs - Snippet TTL in milliseconds. Defaults to {@link SNIPPETS_TTL_MS}.
 * @returns Validated {@link ExternalReputationBlock} ready for the API response.
 *
 * @example
 * ```ts
 * const block = buildExternalReputationBlock(dbRows);
 * // block.items contains only visible, verified platforms
 * ```
 */
export function buildExternalReputationBlock(
    sources: readonly ExternalReputationSource[],
    ttlMs: number = SNIPPETS_TTL_MS
): ExternalReputationBlock {
    const now = Date.now();

    const items: ExternalReputationPlatformItem[] = [];

    for (const src of sources) {
        // Rule 1: skip unverified listings
        if (!src.verified) {
            continue;
        }

        // Rule 2: skip fully-hidden listings
        if (!src.showLink && !src.showReviews) {
            continue;
        }

        const parsedPlatform = ExternalPlatformEnumSchema.safeParse(src.platform);
        if (!parsedPlatform.success) {
            continue;
        }
        const platform = parsedPlatform.data;

        // Rule 3: only expose link fields when showLink is enabled
        const url = src.showLink ? (src.url ?? null) : null;
        const deepLink = src.showLink ? (src.deepLink ?? null) : null;

        // Rule 4: snippets only for GOOGLE + showReviews + within TTL
        let snippets: ExternalReputationPlatformItem['snippets'] = null;
        if (
            src.showReviews &&
            platform === 'GOOGLE' &&
            src.snippetsFetchedAt !== null &&
            src.snippetsFetchedAt !== undefined
        ) {
            const fetchedAt =
                src.snippetsFetchedAt instanceof Date
                    ? src.snippetsFetchedAt.getTime()
                    : new Date(src.snippetsFetchedAt).getTime();

            if (!Number.isNaN(fetchedAt) && now - fetchedAt <= ttlMs) {
                const parsed = z.array(ExternalReviewSnippetSchema).safeParse(src.snippets ?? []);
                if (parsed.success) {
                    snippets = parsed.data;
                }
            }
        }

        // Parse numeric rating defensively (DB may return string from NUMERIC column)
        const ratingRaw = src.rating;
        const rating =
            ratingRaw === null || ratingRaw === undefined
                ? null
                : Number.parseFloat(String(ratingRaw));

        items.push(
            ExternalReputationPlatformItemSchema.parse({
                platform,
                url,
                deepLink,
                rating: Number.isNaN(rating ?? Number.NaN) ? null : rating,
                reviewsCount: src.reviewsCount ?? null,
                snippets
            })
        );
    }

    return ExternalReputationBlockSchema.parse({ items });
}
