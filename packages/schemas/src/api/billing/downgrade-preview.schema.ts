/**
 * Downgrade Preview schema (SPEC-167 T-006 / SPEC-203 UI contract).
 *
 * This shape is the canonical preview object returned by
 * `computeDowngradeExcess` and consumed by the SPEC-203 self-serve plan UI.
 * It is READ-ONLY and carries no mutation instructions — the cron / admin hook
 * use it as the input to the restriction step.
 *
 * Dimensions covered (spec §3):
 *   1. MAX_ACCOMMODATIONS — active accommodations over target cap.
 *   2. MAX_ACTIVE_PROMOTIONS — active promotions over target cap.
 *   3. MAX_PHOTOS_PER_ACCOMMODATION — per-accommodation gallery over target cap.
 *   4. CAN_USE_RICH_DESCRIPTION / CAN_EMBED_VIDEO — grandfather info flags.
 *
 * @module api/billing/downgrade-preview
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Dimension 1 & 2 — entity excess item (accommodations + promotions)
// ---------------------------------------------------------------------------

/**
 * A single accommodation (or active promotion) that is currently active and
 * would be excess under the target plan.
 *
 * `keepByDefault` is `true` for the N items the system will keep active when
 * no explicit selection is made (most-recently-updated first; ties broken by
 * `viewCount` descending when trivially available — see implementation notes).
 */
export const DowngradeExcessItemSchema = z.object({
    /** Entity UUID */
    id: z.string().uuid(),
    /** Human-readable name (accommodation name or promotion title) */
    name: z.string(),
    /** ISO 8601 timestamp from `updatedAt` — used as primary sort key */
    updatedAt: z.string().datetime(),
    /**
     * Total view count when available; `null` if the data source would
     * require a non-trivial join that is out of scope for this read-only pass.
     * Used as tiebreaker ONLY when non-null (descending: more views = kept).
     */
    viewCount: z.number().int().nonnegative().nullable(),
    /**
     * `true` for the first N items in the default-sort order (most-recently-updated).
     * The host can override by supplying an explicit `keepIds` list at schedule time.
     */
    keepByDefault: z.boolean()
});
export type DowngradeExcessItem = z.infer<typeof DowngradeExcessItemSchema>;

/**
 * Accommodation-dimension excess summary.
 */
export const AccommodationExcessSchema = z.object({
    /** Target plan cap (0 = none allowed). */
    cap: z.number().int().nonnegative(),
    /** Count of currently-active, non-plan-restricted accommodations. */
    activeCount: z.number().int().nonnegative(),
    /** Number of accommodations that exceed the cap (activeCount − cap, >= 0). */
    excessCount: z.number().int().nonnegative(),
    /**
     * Full list of active accommodations ordered by default-keep priority
     * (most-recently-updated first, viewCount tiebreaker when available).
     *
     * The first `cap` entries have `keepByDefault: true`;
     * the remaining `excessCount` have `keepByDefault: false`.
     *
     * Empty when there is no excess.
     */
    items: z.array(DowngradeExcessItemSchema)
});
export type AccommodationExcess = z.infer<typeof AccommodationExcessSchema>;

/**
 * Active-promotion-dimension excess summary.
 */
export const PromotionExcessSchema = z.object({
    /** Target plan cap (0 = no promotions allowed). */
    cap: z.number().int().nonnegative(),
    /** Count of currently-active, non-plan-restricted promotions owned by the host. */
    activeCount: z.number().int().nonnegative(),
    /** Number of promotions that exceed the cap. */
    excessCount: z.number().int().nonnegative(),
    /**
     * Full list of active promotions ordered by default-keep priority.
     *
     * The first `cap` entries have `keepByDefault: true`.
     * Empty when there is no excess.
     */
    items: z.array(DowngradeExcessItemSchema)
});
export type PromotionExcess = z.infer<typeof PromotionExcessSchema>;

// ---------------------------------------------------------------------------
// Dimension 3 — per-accommodation photo excess
// ---------------------------------------------------------------------------

/**
 * Photo excess summary for a single accommodation.
 *
 * `featuredImage` always counts toward the cap but is ALWAYS kept (it is
 * excluded from `excessCount` and never appears in the overflow list). Only
 * gallery items beyond (cap − 1) [if a featuredImage exists] or beyond cap
 * [if no featuredImage] are considered excess.
 *
 * The default-keep selection is gallery-order (existing position in the array).
 */
export const AccommodationPhotoExcessSchema = z.object({
    /** Accommodation UUID */
    accommodationId: z.string().uuid(),
    /** Accommodation name for UI display */
    accommodationName: z.string(),
    /** Target photo cap for this plan. */
    cap: z.number().int().nonnegative(),
    /**
     * Total photos currently in this accommodation:
     * gallery.length + (featuredImage ? 1 : 0).
     */
    totalCount: z.number().int().nonnegative(),
    /** Number of gallery photos that will be moved to `archivedGallery`. */
    excessCount: z.number().int().nonnegative(),
    /**
     * True if this accommodation has a featuredImage.
     * The featured image is always kept and does NOT appear in the overflow list.
     */
    hasFeaturedImage: z.boolean(),
    /**
     * Gallery URLs that would be moved to `archivedGallery` (over-cap photos,
     * preserving gallery order — last N gallery items are the overflow).
     * Empty when there is no excess.
     */
    overflowPhotoUrls: z.array(z.string().url())
});
export type AccommodationPhotoExcess = z.infer<typeof AccommodationPhotoExcessSchema>;

// ---------------------------------------------------------------------------
// Dimension 4 — grandfather (rich description / video) info flags
// ---------------------------------------------------------------------------

/**
 * Per-accommodation grandfather-content info flags.
 *
 * Both flags are purely informational — they signal that existing content
 * will become read-only for new edits (gated by
 * `gateRichDescription`/`gateVideoEmbed`) but will NOT be removed.
 */
export const AccommodationGrandfatherFlagsSchema = z.object({
    /** Accommodation UUID */
    accommodationId: z.string().uuid(),
    /** Accommodation name for UI display */
    accommodationName: z.string(),
    /**
     * `true` when the description contains markdown syntax (detected using
     * the same `hasMarkdownSyntax` logic as `gateRichDescription`).
     */
    hasRichDescription: z.boolean(),
    /**
     * `true` when the description contains a video embed URL (YouTube/Vimeo/
     * Dailymotion — same patterns as `gateVideoEmbed`).
     */
    hasVideoEmbed: z.boolean()
});
export type AccommodationGrandfatherFlags = z.infer<typeof AccommodationGrandfatherFlagsSchema>;

// ---------------------------------------------------------------------------
// Top-level preview object (SPEC-203 UI contract)
// ---------------------------------------------------------------------------

/**
 * The structured excess preview returned by `computeDowngradeExcess`.
 *
 * This is the SPEC-203 UI contract:
 * - `accommodations` — quantity-dimension excess and default keep selection.
 * - `promotions` — quantity-dimension excess and default keep selection.
 * - `photos` — per-accommodation photo overflow entries (only accommodations
 *   with excess photos appear).
 * - `grandfatherFlags` — per-accommodation informational flags for rich/video
 *   content that will become read-only (only accommodations with gated content
 *   that the target plan does NOT cover appear).
 * - `hasExcess` — convenience flag: `true` when any dimension has excess.
 */
export const DowngradePreviewSchema = z.object({
    /** Accommodation quantity excess (omitted / default values when plan has no cap). */
    accommodations: AccommodationExcessSchema,
    /** Active-promotion quantity excess. */
    promotions: PromotionExcessSchema,
    /**
     * Per-accommodation photo overflow entries.
     * Only accommodations that exceed the photo cap appear here.
     * Empty array when no accommodation has a photo excess.
     */
    photos: z.array(AccommodationPhotoExcessSchema),
    /**
     * Per-accommodation grandfather-content flags.
     * Only accommodations with rich/video content that the target plan does
     * NOT cover appear here (informational only — no restriction action).
     * Empty when the target plan covers rich/video or no accommodation has it.
     */
    grandfatherFlags: z.array(AccommodationGrandfatherFlagsSchema),
    /**
     * `true` when any dimension (accommodations, promotions, or photos) has
     * `excessCount > 0`. Grandfather flags do NOT count as excess (they are
     * informational / no restriction). Convenience flag for the UI.
     */
    hasExcess: z.boolean()
});
export type DowngradePreview = z.infer<typeof DowngradePreviewSchema>;

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

/**
 * Input schema for `computeDowngradeExcess`.
 *
 * Callers identify the host by `userId` (the host's application user id —
 * consistent with how the downgrade service resolves ownership).
 * The target plan is passed as `targetPlanSlug` (resolved via
 * `getPlanBySlug` from `@repo/billing`) or `targetPlanLimits` (pre-resolved,
 * for callers that already fetched the plan).
 */
export const ComputeDowngradeExcessInputSchema = z.object({
    /** Application user id of the host (used to query their accommodations and promotions). */
    userId: z.string().min(1),
    /**
     * Target plan slug (e.g. `'owner-basico'`).
     * The helper resolves limits via `getPlanBySlug` from `@repo/billing`.
     */
    targetPlanSlug: z.string().min(1)
});
export type ComputeDowngradeExcessInput = z.infer<typeof ComputeDowngradeExcessInputSchema>;
