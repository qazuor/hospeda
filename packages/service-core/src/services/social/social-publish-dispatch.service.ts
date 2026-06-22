/**
 * @file social-publish-dispatch.service.ts
 *
 * Eligibility query and payload assembly for the Make.com dispatch pipeline.
 *
 * This service provides two pure read/assembly methods consumed by the
 * `social-publish-dispatch` cron job (T-045):
 *
 *  - `findEligibleTargets`  — queries `social_post_targets` (joined to their
 *    parent `social_posts`) and returns every target that the cron is allowed
 *    to dispatch on the current run.
 *
 *  - `buildMakePayload`     — assembles the Make.com webhook payload for a
 *    single eligible target without performing any DB mutations, HTTP calls,
 *    or status changes. Those concerns live in T-045 (HTTP push + optimistic
 *    lock) and T-046/T-047 (claim/result callbacks + cascade).
 *
 * This service does NOT extend BaseCrudService.
 * It has NO actor / permission gate — it is always called from cron/system
 * context, never directly from a user-facing API route.
 *
 * @see SPEC-254 T-044 / US-11
 */

import type {
    SocialAssetModel as SocialAssetModelType,
    SocialPlatformFormatModel as SocialPlatformFormatModelType,
    SocialPostFooterModel as SocialPostFooterModelType,
    SocialPostMediaModel as SocialPostMediaModelType,
    SocialPostModel as SocialPostModelType,
    SocialPostTargetModel as SocialPostTargetModelType
} from '@repo/db';
import {
    SocialAssetModel,
    SocialPlatformFormatModel,
    SocialPostFooterModel,
    SocialPostMediaModel,
    SocialPostModel,
    SocialPostTargetModel
} from '@repo/db';
import type { SocialMakePayload } from '@repo/schemas';
import { SocialPostStatusEnum } from '@repo/schemas';
import type { ServiceConfig } from '../../types';
import { serviceLogger } from '../../utils/service-logger';

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/**
 * A bundle of a qualifying `social_post_targets` row together with its parent
 * `social_posts` row.
 *
 * Bundling both rows here means `buildMakePayload` can assemble the payload
 * without issuing any additional queries for the post — only the auxiliary
 * look-ups (platform-format, footer, media assets) are deferred to that step.
 */
export interface EligibleTarget {
    /** Raw `social_post_targets` row (Drizzle select type). */
    readonly target: Record<string, unknown>;
    /** Raw `social_posts` row for the target's parent post. */
    readonly post: Record<string, unknown>;
}

/**
 * Return value of {@link SocialPublishDispatchService.findEligibleTargets}.
 */
export interface FindEligibleTargetsResult {
    /** Every target+post bundle that satisfies the dispatch eligibility criteria. */
    readonly targets: EligibleTarget[];
}

/**
 * Input for {@link SocialPublishDispatchService.buildMakePayload}.
 */
export interface BuildMakePayloadInput {
    /** The eligible target bundle returned by `findEligibleTargets`. */
    readonly target: Record<string, unknown>;
    /** The parent post row from the same bundle. */
    readonly post: Record<string, unknown>;
    /**
     * Base URL of the Hospeda API (e.g. `https://api.hospeda.com.ar`).
     *
     * Sourced by the caller from env `HOSPEDA_API_URL`. This method must NOT
     * read env variables directly so it remains a pure assembly function that
     * is trivially unit-testable without any env setup.
     */
    readonly apiBaseUrl: string;
}

/**
 * Return value of {@link SocialPublishDispatchService.buildMakePayload}.
 */
export interface BuildMakePayloadResult {
    /** Fully assembled Make.com dispatch payload. */
    readonly payload: SocialMakePayload;
}

// ---------------------------------------------------------------------------
// Eligibility constants
// ---------------------------------------------------------------------------

/**
 * Terminal target statuses that are permanently excluded from dispatch.
 *
 * NOTE on SKIPPED: The spec (US-11 and US-13) references `SKIPPED` as a
 * terminal target status in the cascade condition ("PUBLISHED or FAILED or
 * SKIPPED"). However, `SocialPostStatusEnum` has NO `SKIPPED` member —
 * the enum has exactly 10 values: DRAFT, NEEDS_REVIEW, APPROVED, SCHEDULED,
 * READY_TO_PUBLISH, PUBLISHING, PUBLISHED, FAILED, PAUSED, ARCHIVED.
 * This discrepancy is flagged here for T-046/T-047 implementors: do NOT
 * invent a SKIPPED status without a matching enum addition and DB migration.
 */
const TERMINAL_TARGET_STATUSES = [
    SocialPostStatusEnum.PUBLISHED,
    SocialPostStatusEnum.FAILED,
    SocialPostStatusEnum.PUBLISHING
] as const;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Read-only eligibility query and payload assembly service for the
 * Make.com social dispatch pipeline.
 *
 * ## Responsibilities
 * - `findEligibleTargets` — query the DB for targets that are ready to be
 *   pushed to Make.com on the current cron run.
 * - `buildMakePayload` — assemble the exact payload object that Make.com
 *   expects, resolving footer, media URLs, and platform-format config.
 *
 * ## What this service does NOT do
 * - No HTTP calls (T-045).
 * - No optimistic status mutation (T-045).
 * - No retry / failure handling (T-045 / T-046 / T-047).
 * - No cascade (T-046 / T-047).
 * - No permission gate (cron / system context; no actor).
 *
 * SPEC-254 T-044.
 */
export class SocialPublishDispatchService {
    private readonly postModel: SocialPostModelType;
    private readonly targetModel: SocialPostTargetModelType;
    private readonly postMediaModel: SocialPostMediaModelType;
    private readonly platformFormatModel: SocialPlatformFormatModelType;
    private readonly footerModel: SocialPostFooterModelType;
    private readonly assetModel: SocialAssetModelType;

    constructor(
        _config: ServiceConfig,
        postModel?: SocialPostModelType,
        targetModel?: SocialPostTargetModelType,
        postMediaModel?: SocialPostMediaModelType,
        platformFormatModel?: SocialPlatformFormatModelType,
        footerModel?: SocialPostFooterModelType,
        assetModel?: SocialAssetModelType
    ) {
        this.postModel = postModel ?? new SocialPostModel();
        this.targetModel = targetModel ?? new SocialPostTargetModel();
        this.postMediaModel = postMediaModel ?? new SocialPostMediaModel();
        this.platformFormatModel = platformFormatModel ?? new SocialPlatformFormatModel();
        this.footerModel = footerModel ?? new SocialPostFooterModel();
        this.assetModel = assetModel ?? new SocialAssetModel();
    }

    // ---------------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------------

    /**
     * Queries `social_post_targets` (joined to `social_posts`) and returns every
     * target that satisfies ALL dispatch eligibility conditions for this cron run.
     *
     * ## Eligibility conditions (spec US-11)
     * 1. `social_posts.approval_status = APPROVED`
     * 2. `social_posts.status = READY_TO_PUBLISH`
     *    OR (`social_posts.status = SCHEDULED` AND `social_posts.next_run_at <= now()`)
     * 3. `social_posts.paused = false`
     * 4. `social_posts.deleted_at IS NULL`
     * 5. `social_post_targets.status` NOT IN (`PUBLISHED`, `FAILED`, `PUBLISHING`)
     * 6. The parent post has at least one `social_post_media` row (non-empty media).
     *
     * ## Query strategy: two-step model approach
     * The BaseModel `findAll` API does not support cross-table JOINs or `IN ()`
     * sub-selects. Following the pattern established in `SocialPostService.listPosts`
     * (two-step: targets → postIds → posts), we:
     *   Step A — fetch ALL targets (status != terminal) from `social_post_targets`.
     *   Step B — for each unique `socialPostId`, fetch the parent post and apply
     *             post-level conditions (approvalStatus, status/nextRunAt, paused,
     *             deletedAt, and non-empty media check) in application code.
     * This avoids a raw Drizzle query and stays consistent with the service pattern.
     * The result set is bounded by the number of active targets (typically small).
     *
     * @returns `{ targets }` — bundles of qualifying target+post pairs.
     *
     * @example
     * ```ts
     * const { targets } = await service.findEligibleTargets();
     * for (const bundle of targets) {
     *   const { payload } = await service.buildMakePayload({
     *     target: bundle.target,
     *     post: bundle.post,
     *     apiBaseUrl: env.HOSPEDA_API_URL
     *   });
     *   // dispatch payload to Make.com (T-045)
     * }
     * ```
     */
    public async findEligibleTargets(): Promise<FindEligibleTargetsResult> {
        const now = new Date();

        // ---------------------------------------------------------------------------
        // Step A: Fetch all non-terminal targets (no JOIN available in base model).
        // We over-fetch and filter post-conditions in application code.
        // Page size of 1000 is a safe upper bound for active cron targets.
        // ---------------------------------------------------------------------------
        const { items: allTargets } = await this.targetModel.findAll(
            {},
            { page: 1, pageSize: 1000 }
        );

        // Filter out targets in terminal states
        const terminalSet = new Set<string>(TERMINAL_TARGET_STATUSES);
        const candidateTargets = allTargets.filter((t) => {
            const status = t.status as string | undefined;
            return status !== undefined && !terminalSet.has(status);
        });

        if (candidateTargets.length === 0) {
            return { targets: [] };
        }

        // ---------------------------------------------------------------------------
        // Step B: Group candidates by socialPostId, then apply post-level conditions.
        // ---------------------------------------------------------------------------

        // Collect unique post IDs
        const postIdSet = new Set<string>(
            candidateTargets
                .map((t) => t.socialPostId as string | undefined)
                .filter((id): id is string => typeof id === 'string')
        );

        const eligibleBundles: EligibleTarget[] = [];

        for (const postId of postIdSet) {
            // Load the parent post (non-deleted only)
            const post = await this.postModel.findOne({ id: postId, deletedAt: null });
            if (!post) {
                // Post is soft-deleted or doesn't exist — skip all targets for it
                continue;
            }

            // Condition 1: approvalStatus must be APPROVED
            if (post.approvalStatus !== 'APPROVED') {
                continue;
            }

            // Condition 3: paused must be false
            if (post.paused === true) {
                continue;
            }

            // Condition 2: status eligibility
            //   - READY_TO_PUBLISH: always eligible
            //   - SCHEDULED: eligible only when nextRunAt <= now
            const status = post.status as string | undefined;
            const nextRunAt = post.nextRunAt as Date | null | undefined;
            const isReady = status === SocialPostStatusEnum.READY_TO_PUBLISH;
            const isScheduledAndDue =
                status === SocialPostStatusEnum.SCHEDULED &&
                nextRunAt instanceof Date &&
                nextRunAt <= now;

            if (!isReady && !isScheduledAndDue) {
                continue;
            }

            // Condition 6: post must have at least one media row
            const { items: mediaRows } = await this.postMediaModel.findAll(
                { socialPostId: postId },
                { page: 1, pageSize: 1 }
            );
            if (mediaRows.length === 0) {
                continue;
            }

            // Collect targets belonging to this eligible post
            const postTargets = candidateTargets.filter(
                (t) => (t.socialPostId as string | undefined) === postId
            );

            for (const target of postTargets) {
                eligibleBundles.push({ target, post });
            }
        }

        serviceLogger.info(
            { eligibleCount: eligibleBundles.length },
            'SocialPublishDispatchService.findEligibleTargets: query complete'
        );

        return { targets: eligibleBundles };
    }

    /**
     * Assembles the Make.com dispatch payload for a single eligible target.
     *
     * This is a pure assembly method — it performs only read look-ups (platform-
     * format, footer, media assets) and returns the constructed payload. It does
     * NOT mutate any DB row or make HTTP calls.
     *
     * ## Payload field resolution
     * - `platform` + `makeChannelKey` — from `social_platform_formats` via
     *   `target.platformFormatId`.
     * - `publishFormat` — from `social_post_targets.publish_format`.
     * - `captionFinal` — `post.final_caption ?? post.caption_base`.
     * - `hashtagsFinal` — `post.final_hashtags_text ?? ''`.
     * - `footerFinal` — resolved from `social_post_footers.content` via
     *   `post.footer_id`; empty string when `footer_id` is null.
     * - `mediaUrls` — Cloudinary URLs of the post's `social_post_media` rows
     *   ordered by `position` ASC; non-null URLs only.
     * - `callbackClaimUrl` — `${apiBaseUrl}/api/v1/integrations/make/social/jobs/${targetId}/claim`
     * - `callbackResultUrl` — `${apiBaseUrl}/api/v1/integrations/make/social/jobs/${targetId}/result`
     *
     * @param input - The eligible bundle + API base URL.
     * @returns `{ payload }` — the fully assembled Make.com dispatch payload.
     *
     * @example
     * ```ts
     * const { payload } = await service.buildMakePayload({
     *   target: bundle.target,
     *   post: bundle.post,
     *   apiBaseUrl: 'https://api.hospeda.com.ar'
     * });
     * // payload.callbackClaimUrl === 'https://api.hospeda.com.ar/api/v1/integrations/make/social/jobs/<targetId>/claim'
     * ```
     */
    public async buildMakePayload(input: BuildMakePayloadInput): Promise<BuildMakePayloadResult> {
        const { target, post, apiBaseUrl } = input;

        const targetId = target.id as string;
        const postId = post.id as string;

        // -- Platform-format resolution -------------------------------------------
        const platformFormatId = target.platformFormatId as string;
        const platformFormat = await this.platformFormatModel.findOne({ id: platformFormatId });

        const platform =
            (platformFormat?.platform as string | undefined) ?? (target.platform as string);
        const makeChannelKey =
            (platformFormat?.makeChannelKey as string | null | undefined) ?? null;
        const publishFormat = target.publishFormat as string;

        // -- Caption / hashtags ---------------------------------------------------
        const captionFinal =
            (post.finalCaption as string | null | undefined) ?? (post.captionBase as string);
        const hashtagsFinal = (post.finalHashtagsText as string | null | undefined) ?? '';

        // -- Footer resolution -----------------------------------------------------
        const footerId = post.footerId as string | null | undefined;
        let footerFinal = '';
        if (footerId) {
            const footer = await this.footerModel.findOne({ id: footerId });
            footerFinal = (footer?.content as string | null | undefined) ?? '';
        }

        // -- Media URLs ------------------------------------------------------------
        // Fetch all media rows for this post ordered by position ASC,
        // then resolve each assetId to its Cloudinary URL.
        const { items: mediaRows } = await this.postMediaModel.findAll(
            { socialPostId: postId },
            { page: 1, pageSize: 100, sortBy: 'position', sortOrder: 'asc' }
        );

        const mediaUrls: string[] = [];
        for (const mediaRow of mediaRows) {
            const assetId = mediaRow.assetId as string | undefined;
            if (!assetId) continue;
            const asset = await this.assetModel.findOne({ id: assetId });
            const url = asset?.cloudinaryUrl as string | null | undefined;
            if (url) {
                mediaUrls.push(url);
            }
        }

        // -- Scheduling fields -----------------------------------------------------
        const scheduledAt = (post.scheduledAt as Date | null | undefined) ?? null;
        const timezone = post.timezone as string;

        // -- Callback URLs ---------------------------------------------------------
        const callbackClaimUrl = `${apiBaseUrl}/api/v1/integrations/make/social/jobs/${targetId}/claim`;
        const callbackResultUrl = `${apiBaseUrl}/api/v1/integrations/make/social/jobs/${targetId}/result`;

        const payload: SocialMakePayload = {
            targetId,
            postId,
            platform,
            publishFormat,
            makeChannelKey,
            captionFinal,
            hashtagsFinal,
            footerFinal,
            mediaUrls,
            scheduledAt,
            timezone,
            callbackClaimUrl,
            callbackResultUrl
        };

        return { payload };
    }
}
