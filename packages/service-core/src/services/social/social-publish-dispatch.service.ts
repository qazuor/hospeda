/**
 * @file social-publish-dispatch.service.ts
 *
 * Eligibility query, payload assembly, and HTTP dispatch for the Make.com
 * social publishing pipeline.
 *
 * This service provides five methods consumed by the
 * `social-publish-dispatch` cron job and the Make.com result callback:
 *
 *  - `findEligibleTargets`  — queries `social_post_targets` (joined to their
 *    parent `social_posts`) and returns every target that the cron is allowed
 *    to dispatch on the current run.
 *
 *  - `buildMakePayload`     — assembles the Make.com webhook payload for a
 *    single eligible target without performing any DB mutations, HTTP calls,
 *    or status changes.
 *
 *  - `dispatchTarget`       — executes the actual Make.com HTTP push with
 *    optimistic lock, retry logic, and exhaustion cascade (US-11).
 *
 *  - `cascadePostStatus`          — evaluates all targets of a post and, when every
 *    target is terminal (PUBLISHED or FAILED), updates the post-level status
 *    and triggers recurrence rearm (US-13 / T-046).
 *
 *  - `rearmRecurrence`            — recomputes `next_run_at` for the next publish
 *    cycle and performs the clean-slate target reset for recurring posts
 *    (US-14 / T-046).
 *
 *  - `handleMakeCallbackClaim`    — processes the Make.com claim callback: marks
 *    a target as PUBLISHING and records the run ID (US-12 / T-047).
 *
 *  - `handleMakeCallbackResult`   — processes the Make.com result callback: marks
 *    a target PUBLISHED or handles FAILED with retry/exhaustion logic (US-13 / T-047).
 *
 * This service does NOT extend BaseCrudService.
 * It has NO actor / permission gate — it is always called from cron/system
 * context, never directly from a user-facing API route.
 *
 * @see SPEC-254 T-044 / T-045 / T-046 / T-047 / US-11 / US-12 / US-13 / US-14
 */

import type {
    SocialAssetModel as SocialAssetModelType,
    SocialPlatformFormatModel as SocialPlatformFormatModelType,
    SocialPostFooterModel as SocialPostFooterModelType,
    SocialPostMediaModel as SocialPostMediaModelType,
    SocialPostModel as SocialPostModelType,
    SocialPostTargetModel as SocialPostTargetModelType,
    SocialPublishLogModel as SocialPublishLogModelType,
    SocialSettingModel as SocialSettingModelType
} from '@repo/db';
import {
    SocialAssetModel,
    SocialPlatformFormatModel,
    SocialPostFooterModel,
    SocialPostMediaModel,
    SocialPostModel,
    SocialPostTargetModel,
    SocialPublishLogModel,
    SocialSettingModel
} from '@repo/db';
import type { SocialMakePayload } from '@repo/schemas';
import {
    ServiceErrorCode,
    SocialPostStatusEnum,
    SocialPublishResultStatusEnum,
    SocialRecurrenceTypeEnum
} from '@repo/schemas';
import type { ServiceConfig } from '../../types';
import { ServiceError } from '../../types';
import { serviceLogger } from '../../utils/service-logger';
import { SocialAuditLogService } from './social-audit-log.service';
import { SocialAuditEvent } from './social-audit-log.service';

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
// dispatchTarget types
// ---------------------------------------------------------------------------

/**
 * Possible outcomes of a single {@link SocialPublishDispatchService.dispatchTarget} call.
 *
 * - `dispatched`          — HTTP POST succeeded (2xx); a RETRYING log row was inserted;
 *                           the target was set to PUBLISHING.
 * - `retry_scheduled`     — HTTP POST failed but retryCount < 3; retryCount incremented;
 *                           target reset to APPROVED for the next cron run.
 * - `exhausted`           — HTTP POST failed and retryCount was already >= 3 at the time
 *                           of the failure; target set to FAILED; audit event logged.
 * - `skipped_no_webhook`  — `make_webhook_url` setting is empty/missing; no dispatch
 *                           attempted; target status unchanged.
 * - `skipped_locked`      — Another concurrent cron run already claimed this target
 *                           (optimistic lock detected 0 affected rows); no work done.
 */
export type DispatchOutcome =
    | 'dispatched'
    | 'retry_scheduled'
    | 'exhausted'
    | 'skipped_no_webhook'
    | 'skipped_locked';

/**
 * Input for {@link SocialPublishDispatchService.dispatchTarget}.
 */
export interface DispatchTargetInput {
    /** The target row to dispatch (from an {@link EligibleTarget} bundle). */
    readonly target: Record<string, unknown>;
    /** The parent post row for this target. */
    readonly post: Record<string, unknown>;
    /**
     * Make.com API key sent in the `x-make-apikey` header.
     * Provided by the cron caller (which has env access). NEVER read env inside
     * service-core.
     */
    readonly makeApiKey: string;
    /**
     * Base URL of the Hospeda API (e.g. `https://api.hospeda.com.ar`).
     * Used to construct `callbackClaimUrl` / `callbackResultUrl` via `buildMakePayload`.
     * Provided by the cron caller from env `HOSPEDA_API_URL`.
     */
    readonly apiBaseUrl: string;
    /**
     * Optional webhook URL override — when set, skips the live settings look-up.
     * Primarily for testing. In production, pass `undefined` and the method
     * reads `make_webhook_url` from `social_settings`.
     */
    readonly webhookUrl?: string;
}

/**
 * Return value of {@link SocialPublishDispatchService.dispatchTarget}.
 */
export interface DispatchTargetResult {
    /** Outcome of this dispatch attempt. */
    readonly outcome: DispatchOutcome;
    /**
     * Incremented retryCount after a non-exhaustion failure.
     * Present only when `outcome === 'retry_scheduled'`.
     */
    readonly retryCount?: number;
}

// ---------------------------------------------------------------------------
// cascadePostStatus types
// ---------------------------------------------------------------------------

/**
 * Possible outcomes of a {@link SocialPublishDispatchService.cascadePostStatus} call.
 *
 * - `not_all_terminal` — at least one target is still in a non-terminal state
 *   (not PUBLISHED or FAILED). No post-level status change was made.
 * - `post_published`   — all targets reached terminal state and at least one is
 *   PUBLISHED. Post status set to PUBLISHED; recurrence rearmed.
 * - `post_failed`      — all targets reached terminal state and ALL are FAILED.
 *   Post status set to FAILED; `next_run_at` set to null (no rearm).
 */
export type CascadeOutcome = 'not_all_terminal' | 'post_published' | 'post_failed';

/**
 * Input for {@link SocialPublishDispatchService.cascadePostStatus}.
 */
export interface CascadePostStatusInput {
    /** The post ID whose targets should be evaluated. */
    readonly postId: string;
}

/**
 * Return value of {@link SocialPublishDispatchService.cascadePostStatus}.
 */
export interface CascadePostStatusResult {
    /** Whether a cascade was performed and which outcome was reached. */
    readonly outcome: CascadeOutcome;
    /**
     * Present when `outcome === 'post_published'` for a recurring post.
     * The newly computed next_run_at value.
     */
    readonly nextRunAt?: Date | null;
}

// ---------------------------------------------------------------------------
// rearmRecurrence types
// ---------------------------------------------------------------------------

/**
 * Input for {@link SocialPublishDispatchService.rearmRecurrence}.
 */
export interface RearmRecurrenceInput {
    /** The parent post row (raw DB record). Must include: id, recurrenceType,
     * recurrenceParamsJson, timezone, and status columns. */
    readonly post: Record<string, unknown>;
    /**
     * Override for "now". Accepts a Date for testability.
     * Defaults to `new Date()` when not provided.
     */
    readonly now?: Date;
}

/**
 * Return value of {@link SocialPublishDispatchService.rearmRecurrence}.
 */
export interface RearmRecurrenceResult {
    /**
     * The computed `next_run_at` value written to the post row.
     * - `null` for ONCE posts (no rearm).
     * - A future Date for WEEKLY / BIWEEKLY / MONTHLY posts.
     */
    readonly nextRunAt: Date | null;
    /**
     * True when the post and all its targets were reset for the next cycle
     * (WEEKLY / BIWEEKLY / MONTHLY). False for ONCE posts (no reset).
     */
    readonly rearmed: boolean;
}

// ---------------------------------------------------------------------------
// handleMakeCallbackClaim types (T-047)
// ---------------------------------------------------------------------------

/**
 * Input for {@link SocialPublishDispatchService.handleMakeCallbackClaim}.
 */
export interface HandleMakeCallbackClaimInput {
    /** The social_post_target ID being claimed by Make.com. */
    readonly targetId: string;
    /** The Make.com scenario run ID for correlation. */
    readonly makeRunId: string;
}

/**
 * Return value of {@link SocialPublishDispatchService.handleMakeCallbackClaim}.
 */
export interface HandleMakeCallbackClaimResult {
    /** The target ID (echoed back). */
    readonly targetId: string;
    /** The new target status — always 'PUBLISHING' on success. */
    readonly status: 'PUBLISHING';
}

// ---------------------------------------------------------------------------
// handleMakeCallbackResult types (T-047)
// ---------------------------------------------------------------------------

/**
 * Make-reported result status from the result callback.
 * Only SUCCESS and FAILED are accepted inbound values.
 */
export type MakeCallbackResultStatus = 'SUCCESS' | 'FAILED';

/**
 * Input for {@link SocialPublishDispatchService.handleMakeCallbackResult}.
 */
export interface HandleMakeCallbackResultInput {
    /** The social_post_target ID the result applies to. */
    readonly targetId: string;
    /**
     * Make-reported outcome.  Must be exactly 'SUCCESS' or 'FAILED'.
     * Any other value is rejected with VALIDATION_ERROR.
     */
    readonly status: MakeCallbackResultStatus;
    /** External post ID on the social platform (SUCCESS path). */
    readonly externalPostId?: string;
    /** Public URL of the published post (SUCCESS path). */
    readonly externalPostUrl?: string;
    /** Make.com run ID for traceability (optional). */
    readonly makeRunId?: string;
    /** Human-readable error description (FAILED path). */
    readonly errorMessage?: string;
}

/**
 * Return value of {@link SocialPublishDispatchService.handleMakeCallbackResult}.
 */
export interface HandleMakeCallbackResultResult {
    /** The target ID (echoed back). */
    readonly targetId: string;
    /**
     * Final target status after processing the callback.
     * 'PUBLISHED' on success; 'APPROVED' when retrying; 'FAILED' when exhausted.
     */
    readonly status: 'PUBLISHED' | 'APPROVED' | 'FAILED';
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
 *
 * Owner decision (applied): terminal states for the cascade check are ONLY
 * PUBLISHED and FAILED (SKIPPED is dropped per owner decision).
 */
const TERMINAL_TARGET_STATUSES = [
    SocialPostStatusEnum.PUBLISHED,
    SocialPostStatusEnum.FAILED,
    SocialPostStatusEnum.PUBLISHING
] as const;

/**
 * Statuses considered truly terminal for the cascade exhaustion check.
 * Per owner decision: only PUBLISHED and FAILED count as terminal.
 * PUBLISHING is excluded — a target in PUBLISHING is still being processed.
 */
const CASCADE_TERMINAL_STATUSES = new Set<string>([
    SocialPostStatusEnum.PUBLISHED,
    SocialPostStatusEnum.FAILED
]);

/**
 * Maximum retries before a target is marked FAILED.
 *
 * Retry boundary interpretation: `retryCount` is the number of PRIOR failures
 * already recorded. When a new failure occurs:
 *  - If retryCount >= 3 at failure time → exhaust (the 4th attempt is the
 *    one that triggers exhaustion, meaning at most 3 actual retries after the
 *    initial dispatch).
 *  - If retryCount < 3 → increment to (retryCount + 1) and reschedule.
 *
 * This guarantees at most 4 total dispatch attempts (initial + 3 retries)
 * before the target is exhausted, matching the spec literal
 * "retry_count >= 3 when a failure occurs → FAILED".
 */
const MAX_RETRY_COUNT = 3;

/**
 * Timeout in milliseconds for the Make.com webhook HTTP POST.
 */
const MAKE_WEBHOOK_TIMEOUT_MS = 15_000;

/**
 * `social_settings` key for the Make.com webhook URL.
 */
const MAKE_WEBHOOK_URL_KEY = 'make_webhook_url';

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Read-only eligibility query, payload assembly, and HTTP dispatch service
 * for the Make.com social publishing pipeline.
 *
 * ## Responsibilities
 * - `findEligibleTargets` — query the DB for targets that are ready to be
 *   pushed to Make.com on the current cron run.
 * - `buildMakePayload` — assemble the exact payload object that Make.com
 *   expects, resolving footer, media URLs, and platform-format config.
 * - `dispatchTarget` — execute the HTTP POST to Make.com with optimistic lock
 *   and retry/exhaustion logic (US-11).
 * - `cascadePostStatus` — evaluate all sibling targets and, when all are
 *   terminal, update the post-level status; trigger recurrence rearm (T-046).
 * - `rearmRecurrence` — recompute `next_run_at` and reset targets for the
 *   next publish cycle for recurring posts (T-046 / US-14).
 *
 * ## What this service does NOT do
 * - No auth gate for Make callbacks (handled at the route layer in T-048).
 * - No permission gate (cron / system context; no actor).
 *
 * SPEC-254 T-044 / T-045 / T-046 / T-047.
 */
export class SocialPublishDispatchService {
    private readonly postModel: SocialPostModelType;
    private readonly targetModel: SocialPostTargetModelType;
    private readonly postMediaModel: SocialPostMediaModelType;
    private readonly platformFormatModel: SocialPlatformFormatModelType;
    private readonly footerModel: SocialPostFooterModelType;
    private readonly assetModel: SocialAssetModelType;
    private readonly publishLogModel: SocialPublishLogModelType;
    private readonly settingModel: SocialSettingModelType;
    private readonly auditLog: SocialAuditLogService;

    constructor(
        config: ServiceConfig,
        postModel?: SocialPostModelType,
        targetModel?: SocialPostTargetModelType,
        postMediaModel?: SocialPostMediaModelType,
        platformFormatModel?: SocialPlatformFormatModelType,
        footerModel?: SocialPostFooterModelType,
        assetModel?: SocialAssetModelType,
        publishLogModel?: SocialPublishLogModelType,
        settingModel?: SocialSettingModelType,
        auditLog?: SocialAuditLogService
    ) {
        this.postModel = postModel ?? new SocialPostModel();
        this.targetModel = targetModel ?? new SocialPostTargetModel();
        this.postMediaModel = postMediaModel ?? new SocialPostMediaModel();
        this.platformFormatModel = platformFormatModel ?? new SocialPlatformFormatModel();
        this.footerModel = footerModel ?? new SocialPostFooterModel();
        this.assetModel = assetModel ?? new SocialAssetModel();
        this.publishLogModel = publishLogModel ?? new SocialPublishLogModel();
        this.settingModel = settingModel ?? new SocialSettingModel();
        this.auditLog = auditLog ?? new SocialAuditLogService(config);
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

    /**
     * Dispatches a single eligible target to Make.com via HTTP POST.
     *
     * ## Steps (US-11)
     * 1. **Webhook read** — load `make_webhook_url` from `social_settings` (or
     *    use `input.webhookUrl` override for tests). If empty/missing → return
     *    `{ outcome: 'skipped_no_webhook' }` with a warning log. Target unchanged.
     * 2. **Optimistic lock** — set `target.status = PUBLISHING` before the HTTP
     *    call. If the model supports a guarded update (WHERE status != PUBLISHING),
     *    a 0-row result means another cron instance already claimed it → return
     *    `{ outcome: 'skipped_locked' }`. This service uses a plain `update` (no
     *    conditional WHERE) because `BaseModelImpl.update` does not expose a
     *    WHERE-clause guard on the caller side. The weaker guarantee is documented:
     *    two concurrent cron runs that both read the target as APPROVED may both
     *    set it to PUBLISHING and dispatch — the second Make callback will be a
     *    no-op or idempotent depending on Make.com's deduplication. This is
     *    acceptable for the current risk level; a proper atomic CAS can be added
     *    with a raw-SQL helper when needed.
     * 3. **Build payload** — `buildMakePayload({ target, post, apiBaseUrl })`.
     *    Persists the outbound payload JSON to `target.makePayloadJson`.
     * 4. **HTTP POST** — `fetch(webhookUrl, { method:'POST', headers: {...}, body })`.
     *    Wrapped in try/catch (network/timeout treated as failure).
     * 5. **On 2xx** — insert `social_publish_logs` row (status=RETRYING); set
     *    post status to PUBLISHING if not already; return `{ outcome: 'dispatched' }`.
     * 6. **On failure** (non-2xx OR exception):
     *    - `retryCount < 3` → increment retryCount, reset target to APPROVED,
     *      insert log (status=FAILED); return `{ outcome:'retry_scheduled', retryCount }`.
     *    - `retryCount >= 3` → set target to FAILED, insert log (status=FAILED),
     *      check sibling exhaustion → if all siblings are PUBLISHED|FAILED set post
     *      to FAILED, log audit `TARGET_DISPATCH_FAILED_EXHAUSTED`;
     *      return `{ outcome: 'exhausted' }`.
     *
     * ## Retry boundary
     * `retryCount` is the count of PRIOR failures at the moment the new failure
     * occurs. Exhaustion fires when the current `retryCount >= 3` — meaning the
     * target has already failed 3 times and is now failing a 4th time. This
     * guarantees at most 4 total dispatch attempts (initial + 3 retries).
     *
     * ## Env injection
     * `makeApiKey` and `apiBaseUrl` are always passed in by the cron caller.
     * This service NEVER reads `process.env` directly.
     *
     * @param input - Target, post, credentials, and optional webhook URL override.
     * @returns `{ outcome }` describing the result of this dispatch attempt.
     *
     * @example
     * ```ts
     * const result = await service.dispatchTarget({
     *   target: bundle.target,
     *   post: bundle.post,
     *   makeApiKey: env.MAKE_API_KEY,
     *   apiBaseUrl: env.HOSPEDA_API_URL,
     * });
     * if (result.outcome === 'dispatched') {
     *   logger.info('Dispatch submitted; awaiting Make callback');
     * }
     * ```
     */
    public async dispatchTarget(input: DispatchTargetInput): Promise<DispatchTargetResult> {
        const { target, post, makeApiKey, apiBaseUrl, webhookUrl: webhookOverride } = input;

        const targetId = target.id as string;
        const postId = post.id as string;
        const currentRetryCount = (target.retryCount as number | undefined) ?? 0;
        const platform = target.platform as string | undefined;
        const publishFormat = target.publishFormat as string | undefined;

        // -------------------------------------------------------------------------
        // Step 1: Resolve webhook URL
        // Read live from settings unless a test override is provided.
        // -------------------------------------------------------------------------
        let webhookUrl: string;

        if (webhookOverride !== undefined && webhookOverride !== '') {
            webhookUrl = webhookOverride;
        } else {
            const settingRow = await this.settingModel.findOne({ key: MAKE_WEBHOOK_URL_KEY });
            const settingValue = (settingRow?.value as string | null | undefined) ?? '';

            if (!settingValue) {
                serviceLogger.warn(
                    { targetId, postId },
                    `SocialPublishDispatchService.dispatchTarget: '${MAKE_WEBHOOK_URL_KEY}' setting is empty or missing — skipping dispatch`
                );
                return { outcome: 'skipped_no_webhook' };
            }
            webhookUrl = settingValue;
        }

        // -------------------------------------------------------------------------
        // Step 2: Optimistic lock — claim the target by setting status = PUBLISHING
        //
        // NOTE: BaseModelImpl.update does not support a conditional WHERE clause
        // (e.g. "WHERE status = 'APPROVED'"). We perform a plain update here.
        // Weaker guarantee: two concurrent cron runs that both read a target as
        // APPROVED may both set it to PUBLISHING and dispatch a duplicate payload
        // to Make.com. The Make.com callback is treated as idempotent at the
        // callback layer (T-047). A proper CAS guard can be added via a raw SQL
        // helper if stronger isolation is required in the future.
        // -------------------------------------------------------------------------
        await this.targetModel.update(
            { id: targetId },
            { status: SocialPostStatusEnum.PUBLISHING }
        );

        // -------------------------------------------------------------------------
        // Step 3: Build payload and persist it to makePayloadJson
        // -------------------------------------------------------------------------
        const { payload } = await this.buildMakePayload({ target, post, apiBaseUrl });

        await this.targetModel.update(
            { id: targetId },
            // TYPE-WORKAROUND: serialize the typed Make payload into the jsonb target column (Record<string, unknown>).
            { makePayloadJson: payload as unknown as Record<string, unknown> }
        );

        // -------------------------------------------------------------------------
        // Step 4: HTTP POST to Make.com webhook
        // -------------------------------------------------------------------------
        let httpSuccess = false;
        let failureMessage = '';

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), MAKE_WEBHOOK_TIMEOUT_MS);

            let response: Response;
            try {
                response = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'x-make-apikey': makeApiKey
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });
            } finally {
                clearTimeout(timeoutId);
            }

            if (response.ok) {
                httpSuccess = true;
            } else {
                failureMessage = `HTTP ${response.status}: ${response.statusText}`;
            }
        } catch (err) {
            failureMessage = err instanceof Error ? err.message : String(err);
        }

        // -------------------------------------------------------------------------
        // Step 5: Success path
        // -------------------------------------------------------------------------
        if (httpSuccess) {
            // Insert publish log row: status = RETRYING (waiting for Make callback)
            await this.publishLogModel.create({
                socialPostId: postId,
                socialPostTargetId: targetId,
                platform,
                publishFormat,
                status: SocialPublishResultStatusEnum.RETRYING,
                message: 'Dispatched to Make; awaiting callback',
                // TYPE-WORKAROUND: serialize the typed Make payload into the jsonb publish-log column (Record<string, unknown>).
                requestPayloadJson: payload as unknown as Record<string, unknown>
            });

            // Advance post to PUBLISHING if it is not already
            const currentPostStatus = post.status as string | undefined;
            if (currentPostStatus !== SocialPostStatusEnum.PUBLISHING) {
                await this.postModel.update(
                    { id: postId },
                    { status: SocialPostStatusEnum.PUBLISHING }
                );
            }

            serviceLogger.info(
                { targetId, postId },
                'SocialPublishDispatchService.dispatchTarget: dispatched to Make; awaiting callback'
            );

            return { outcome: 'dispatched' };
        }

        // -------------------------------------------------------------------------
        // Step 6: Failure path
        // -------------------------------------------------------------------------

        if (currentRetryCount >= MAX_RETRY_COUNT) {
            // Exhaustion: max retries already reached — mark target as permanently FAILED
            await this.targetModel.update(
                { id: targetId },
                {
                    status: SocialPostStatusEnum.FAILED,
                    lastErrorMessage: failureMessage,
                    retryCount: currentRetryCount
                }
            );

            await this.publishLogModel.create({
                socialPostId: postId,
                socialPostTargetId: targetId,
                platform,
                publishFormat,
                status: SocialPublishResultStatusEnum.FAILED,
                message: failureMessage,
                // TYPE-WORKAROUND: serialize the typed Make payload into the jsonb publish-log column (Record<string, unknown>).
                requestPayloadJson: payload as unknown as Record<string, unknown>
            });

            // Check if ALL sibling targets for this post are now terminal
            await this.checkAndCascadePostFailure({ postId, excludeTargetId: targetId });

            // Log audit event for exhaustion
            await this.auditLog.log({
                eventType: SocialAuditEvent.TARGET_DISPATCH_FAILED_EXHAUSTED,
                entityType: 'social_post_target',
                entityId: targetId,
                metadata: {
                    postId,
                    retryCount: currentRetryCount,
                    error: failureMessage
                }
            });

            serviceLogger.warn(
                { targetId, postId, retryCount: currentRetryCount, error: failureMessage },
                'SocialPublishDispatchService.dispatchTarget: target exhausted after max retries'
            );

            return { outcome: 'exhausted' };
        }

        // Retry: increment retryCount and reset target back to APPROVED
        const newRetryCount = currentRetryCount + 1;

        await this.targetModel.update(
            { id: targetId },
            {
                status: SocialPostStatusEnum.APPROVED,
                lastErrorMessage: failureMessage,
                retryCount: newRetryCount
            }
        );

        await this.publishLogModel.create({
            socialPostId: postId,
            socialPostTargetId: targetId,
            platform,
            publishFormat,
            status: SocialPublishResultStatusEnum.FAILED,
            message: failureMessage,
            // TYPE-WORKAROUND: serialize the typed Make payload into the jsonb publish-log column (Record<string, unknown>).
            requestPayloadJson: payload as unknown as Record<string, unknown>
        });

        serviceLogger.info(
            { targetId, postId, newRetryCount, error: failureMessage },
            'SocialPublishDispatchService.dispatchTarget: dispatch failed; retry scheduled'
        );

        return { outcome: 'retry_scheduled', retryCount: newRetryCount };
    }

    // ---------------------------------------------------------------------------
    // Public cascade / recurrence API (T-046)
    // ---------------------------------------------------------------------------

    /**
     * Evaluates all targets of a post and cascades the post-level status once
     * every target reaches a terminal state (PUBLISHED or FAILED).
     *
     * ## Decision table
     * | Targets state              | Action                                      |
     * |----------------------------|---------------------------------------------|
     * | Any target is non-terminal | No change — return `{ outcome: 'not_all_terminal' }` |
     * | All terminal, ≥1 PUBLISHED | Post → PUBLISHED; call `rearmRecurrence`    |
     * | All terminal, all FAILED   | Post → FAILED; `next_run_at` → null (spec edge-case §313: recurrence does NOT rearm on full failure) |
     *
     * This method is called by the Make.com result callback (T-047) and by the
     * dispatch exhaustion path.
     *
     * @param input - `{ postId }` — the post whose targets should be evaluated.
     * @returns The cascade outcome and (for recurring published posts) the new `nextRunAt`.
     *
     * @example
     * ```ts
     * const result = await service.cascadePostStatus({ postId: 'abc-123' });
     * if (result.outcome === 'post_published') {
     *   logger.info({ nextRunAt: result.nextRunAt }, 'Post published; recurrence armed');
     * }
     * ```
     */
    public async cascadePostStatus(
        input: CascadePostStatusInput
    ): Promise<CascadePostStatusResult> {
        const { postId } = input;

        // Load ALL targets for this post
        const { items: allTargets } = await this.targetModel.findAll(
            { socialPostId: postId },
            { page: 1, pageSize: 1000 }
        );

        // Check if every target is in a terminal state
        const allTerminal = allTargets.every((t) => {
            const s = t.status as string | undefined;
            return s !== undefined && CASCADE_TERMINAL_STATUSES.has(s);
        });

        if (!allTerminal) {
            serviceLogger.info(
                { postId },
                'SocialPublishDispatchService.cascadePostStatus: not all targets terminal; skipping'
            );
            return { outcome: 'not_all_terminal' };
        }

        // Determine whether at least one target is PUBLISHED
        const anyPublished = allTargets.some(
            (t) => (t.status as string | undefined) === SocialPostStatusEnum.PUBLISHED
        );

        if (anyPublished) {
            // Set post to PUBLISHED and rearm recurrence
            await this.postModel.update({ id: postId }, { status: SocialPostStatusEnum.PUBLISHED });

            // Reload the post to obtain recurrence fields (recurrenceType, timezone, etc.)
            const post = await this.postModel.findOne({ id: postId });
            const rearmResult = post
                ? await this.rearmRecurrence({ post })
                : { nextRunAt: null, rearmed: false };

            serviceLogger.info(
                { postId, nextRunAt: rearmResult.nextRunAt, rearmed: rearmResult.rearmed },
                'SocialPublishDispatchService.cascadePostStatus: post PUBLISHED; recurrence armed'
            );

            return { outcome: 'post_published', nextRunAt: rearmResult.nextRunAt };
        }

        // All targets are FAILED — post fails; no rearm (spec edge-case §313)
        await this.postModel.update(
            { id: postId },
            {
                status: SocialPostStatusEnum.FAILED,
                nextRunAt: null
            }
        );

        serviceLogger.warn(
            { postId },
            'SocialPublishDispatchService.cascadePostStatus: all targets FAILED — post FAILED, next_run_at nulled'
        );

        return { outcome: 'post_failed' };
    }

    /**
     * Recomputes `next_run_at` for the post's next publish cycle and, for recurring
     * posts (WEEKLY / BIWEEKLY / MONTHLY), performs a clean-slate reset so the
     * dispatch cron can re-pick the post when `next_run_at <= now`.
     *
     * ## Clean-slate rearm (WEEKLY / BIWEEKLY / MONTHLY)
     * 1. Set `post.status = APPROVED` (dispatch cron condition: status = APPROVED +
     *    next_run_at <= now).
     * 2. Keep `post.approvalStatus = APPROVED` (recurrence auto-reuses approval).
     * 3. Reset ALL of the post's targets to `status = APPROVED`, `retry_count = 0`.
     * 4. Set `next_run_at` to the computed future date.
     *
     * ## ONCE posts
     * `next_run_at` is set to `null`. The post STAYS PUBLISHED; targets are NOT reset.
     *
     * ## WEEKLY timezone computation
     * Uses `Intl.DateTimeFormat` with the post's IANA `timezone` to determine the
     * current weekday in the post's local time, then adds the minimum number of days
     * (0–6) to reach the target weekday. This avoids the `date-fns-tz` dependency.
     *
     * ## MONTHLY clamping
     * If the source day-of-month exceeds the length of the target month (e.g. Jan 31
     * → Feb), the date is clamped to the last day of the target month. This follows
     * the principle of least surprise: the post fires as late as possible within the
     * intended month, not the following month.
     *
     * @param input - Post row and optional `now` override for testability.
     * @returns `{ nextRunAt, rearmed }` — the new next_run_at and whether targets were reset.
     *
     * @example
     * ```ts
     * const { nextRunAt, rearmed } = await service.rearmRecurrence({ post });
     * logger.info({ nextRunAt, rearmed }, 'Recurrence rearmed');
     * ```
     */
    public async rearmRecurrence(input: RearmRecurrenceInput): Promise<RearmRecurrenceResult> {
        const { post, now: nowOverride } = input;
        const now = nowOverride ?? new Date();

        const postId = post.id as string;
        const recurrenceType =
            (post.recurrenceType as string | undefined) ?? SocialRecurrenceTypeEnum.ONCE;
        const recurrenceParamsJson = post.recurrenceParamsJson as
            | Record<string, unknown>
            | null
            | undefined;
        const timezone = (post.timezone as string | undefined) ?? 'UTC';

        // -------------------------------------------------------------------------
        // ONCE: no rearm, no target reset
        // -------------------------------------------------------------------------
        if (recurrenceType === SocialRecurrenceTypeEnum.ONCE) {
            await this.postModel.update({ id: postId }, { nextRunAt: null });

            serviceLogger.info(
                { postId },
                'SocialPublishDispatchService.rearmRecurrence: ONCE post — next_run_at nulled, no reset'
            );

            return { nextRunAt: null, rearmed: false };
        }

        // -------------------------------------------------------------------------
        // Compute next_run_at based on recurrence type
        // -------------------------------------------------------------------------
        let nextRunAt: Date;

        if (recurrenceType === SocialRecurrenceTypeEnum.BIWEEKLY) {
            // BIWEEKLY: now + 14 days (simple, timezone-agnostic wall-clock arithmetic)
            nextRunAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        } else if (recurrenceType === SocialRecurrenceTypeEnum.MONTHLY) {
            // MONTHLY: same day-of-month next month, clamped to last day of target month
            nextRunAt = this.computeNextMonthlyDate(now);
        } else {
            // WEEKLY: next occurrence of the configured weekday in the post's timezone
            const weekdayName = (recurrenceParamsJson?.weekday as string | undefined) ?? 'MONDAY';
            nextRunAt = this.computeNextWeeklyDate({ now, weekdayName, timezone });
        }

        // -------------------------------------------------------------------------
        // Clean-slate rearm: reset post + all targets
        // -------------------------------------------------------------------------
        await this.postModel.update(
            { id: postId },
            {
                status: SocialPostStatusEnum.APPROVED,
                nextRunAt
            }
        );

        // Reset all targets for this post to APPROVED with retry_count = 0
        const { items: allTargets } = await this.targetModel.findAll(
            { socialPostId: postId },
            { page: 1, pageSize: 1000 }
        );

        for (const target of allTargets) {
            const targetId = target.id as string;
            await this.targetModel.update(
                { id: targetId },
                {
                    status: SocialPostStatusEnum.APPROVED,
                    retryCount: 0
                }
            );
        }

        serviceLogger.info(
            { postId, recurrenceType, nextRunAt, targetCount: allTargets.length },
            'SocialPublishDispatchService.rearmRecurrence: recurring post rearmed; targets reset'
        );

        return { nextRunAt, rearmed: true };
    }

    // ---------------------------------------------------------------------------
    // Make.com callback API (T-047)
    // ---------------------------------------------------------------------------

    /**
     * Processes the Make.com **claim** callback: transitions the target to
     * `PUBLISHING` and records the Make run ID.
     *
     * ## Auth note
     * The `x-hospeda-make-key` header authentication is handled at the ROUTE layer
     * (T-048) — this method performs pure business logic with no auth check.
     *
     * ## make_payload_json note
     * The spec says `make_payload_json` "is updated" on claim. The payload is
     * already persisted by `dispatchTarget` at dispatch time (step 3). We do NOT
     * overwrite it here because the claim callback carries no new payload data.
     * If Make.com sends payload fields on claim in the future, they should be
     * merged at this point.
     *
     * @param input - `{ targetId, makeRunId }` from the inbound claim body.
     * @returns `{ targetId, status: 'PUBLISHING' }` on success.
     *
     * @throws {ServiceError} `NOT_FOUND` when `targetId` does not exist.
     * @throws {ServiceError} `ALREADY_EXISTS` (reason: 'ALREADY_PUBLISHED') when
     *   the target is already in `PUBLISHED` state — maps to HTTP 409 at the route layer.
     *
     * @example
     * ```ts
     * const result = await service.handleMakeCallbackClaim({
     *   targetId: 'abc-123',
     *   makeRunId: 'run-xyz'
     * });
     * // result.status === 'PUBLISHING'
     * ```
     */
    public async handleMakeCallbackClaim(
        input: HandleMakeCallbackClaimInput
    ): Promise<HandleMakeCallbackClaimResult> {
        const { targetId, makeRunId } = input;

        // -------------------------------------------------------------------------
        // Load the target; 404 if not found
        // -------------------------------------------------------------------------
        const target = await this.targetModel.findOne({ id: targetId });
        if (!target) {
            throw new ServiceError(
                ServiceErrorCode.NOT_FOUND,
                `social_post_target not found: ${targetId}`
            );
        }

        // -------------------------------------------------------------------------
        // Already PUBLISHED guard — 409 idempotency check
        // Using ALREADY_EXISTS (the ServiceErrorCode that maps to HTTP 409) with
        // reason 'ALREADY_PUBLISHED' for machine-readable discrimination at route layer.
        // -------------------------------------------------------------------------
        if ((target.status as string) === SocialPostStatusEnum.PUBLISHED) {
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'Target already published',
                undefined,
                'ALREADY_PUBLISHED'
            );
        }

        // -------------------------------------------------------------------------
        // Transition to PUBLISHING and record the Make run ID.
        // make_payload_json is already set by dispatchTarget — left unchanged (see JSDoc).
        // -------------------------------------------------------------------------
        await this.targetModel.update(
            { id: targetId },
            {
                status: SocialPostStatusEnum.PUBLISHING,
                makeLastRunId: makeRunId
            }
        );

        serviceLogger.info(
            { targetId, makeRunId },
            'SocialPublishDispatchService.handleMakeCallbackClaim: target claimed by Make'
        );

        return { targetId, status: 'PUBLISHING' };
    }

    /**
     * Processes the Make.com **result** callback: marks the target as PUBLISHED
     * or handles FAILED with retry / exhaustion logic, then cascades post-level status.
     *
     * ## Auth note
     * The `x-hospeda-make-key` header authentication is handled at the ROUTE layer
     * (T-048) — this method performs pure business logic with no auth check.
     *
     * ## Retry-increment loop-safety
     * On a FAILED callback, `retryCount` is INCREMENTED FIRST, then compared against
     * `MAX_RETRY_COUNT`.  This prevents the cron ↔ callback retry loop from running
     * forever:
     *
     *  - Without pre-increment: cron dispatches → Make fails → callback resets status
     *    to APPROVED without moving retryCount → cron re-dispatches → repeat.
     *  - With pre-increment (this implementation): each callback failure costs one
     *    retry credit; at most 3 callback failures (newRetryCount reaching 3) before
     *    the target is permanently marked FAILED.
     *
     * Combined retry budget across dispatch and callback:
     *  - `dispatchTarget` increments retryCount when dispatch HTTP POST fails.
     *  - `handleMakeCallbackResult` increments retryCount when Make reports FAILED.
     *  - Both paths check `>= MAX_RETRY_COUNT` AFTER incrementing.
     *  - Since `dispatchTarget` exhausts (sets FAILED) when `retryCount >= 3` at
     *    dispatch time, a target that has already burned 3 dispatch retries never
     *    reaches this callback.  A successfully dispatched target (retryCount = 0 or
     *    1 after prior dispatch retries) gets up to 3 callback retries.  The combined
     *    maximum is 3 dispatch + 3 callback = 6, but the two paths are mutually
     *    exclusive per target (dispatch exhaustion prevents callback from running).
     *    In the common case (successful dispatch on first try), the target gets at
     *    most 3 total attempts via the callback path alone.
     *
     * @param input - Result payload from Make.com.
     * @returns `{ targetId, status }` — 'PUBLISHED', 'APPROVED', or 'FAILED'.
     *
     * @throws {ServiceError} `NOT_FOUND` when `targetId` does not exist.
     * @throws {ServiceError} `VALIDATION_ERROR` when `status` is not 'SUCCESS' or 'FAILED'.
     *
     * @example
     * ```ts
     * const result = await service.handleMakeCallbackResult({
     *   targetId: 'abc-123',
     *   status: 'SUCCESS',
     *   externalPostId: 'ig-post-456',
     *   externalPostUrl: 'https://instagram.com/p/abc',
     *   makeRunId: 'run-xyz'
     * });
     * // result.status === 'PUBLISHED'
     * ```
     */
    public async handleMakeCallbackResult(
        input: HandleMakeCallbackResultInput
    ): Promise<HandleMakeCallbackResultResult> {
        const { targetId, status, externalPostId, externalPostUrl, makeRunId, errorMessage } =
            input;

        // -------------------------------------------------------------------------
        // Validate the inbound status — only SUCCESS or FAILED are accepted
        // -------------------------------------------------------------------------
        if (status !== 'SUCCESS' && status !== 'FAILED') {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                `Invalid Make callback status: ${status}. Expected 'SUCCESS' or 'FAILED'.`
            );
        }

        // -------------------------------------------------------------------------
        // Load the target; 404 if not found
        // -------------------------------------------------------------------------
        const target = await this.targetModel.findOne({ id: targetId });
        if (!target) {
            throw new ServiceError(
                ServiceErrorCode.NOT_FOUND,
                `social_post_target not found: ${targetId}`
            );
        }

        const postId = target.socialPostId as string;
        const platform = target.platform as string | undefined;
        const publishFormat = target.publishFormat as string | undefined;

        // -------------------------------------------------------------------------
        // SUCCESS path
        // -------------------------------------------------------------------------
        if (status === 'SUCCESS') {
            const publishedAt = new Date();

            // Update target to PUBLISHED with all external post identifiers
            await this.targetModel.update(
                { id: targetId },
                {
                    status: SocialPostStatusEnum.PUBLISHED,
                    publishedAt,
                    externalPostId: externalPostId ?? null,
                    externalPostUrl: externalPostUrl ?? null,
                    ...(makeRunId !== undefined ? { makeLastRunId: makeRunId } : {})
                }
            );

            // Insert publish log: SUCCESS
            await this.publishLogModel.create({
                socialPostId: postId,
                socialPostTargetId: targetId,
                platform,
                publishFormat,
                status: SocialPublishResultStatusEnum.SUCCESS,
                message: 'Published via Make',
                externalPostId: externalPostId ?? null,
                externalPostUrl: externalPostUrl ?? null,
                makeRunId: makeRunId ?? null,
                responsePayloadJson: null
            });

            // Audit TARGET_PUBLISHED
            await this.auditLog.log({
                eventType: SocialAuditEvent.TARGET_PUBLISHED,
                entityType: 'social_post_target',
                entityId: targetId,
                metadata: {
                    postId,
                    externalPostId: externalPostId ?? null
                }
            });

            // Cascade post-level status (may finalize post and rearm recurrence)
            await this.cascadePostStatus({ postId });

            serviceLogger.info(
                { targetId, postId, externalPostId, externalPostUrl },
                'SocialPublishDispatchService.handleMakeCallbackResult: target PUBLISHED'
            );

            return { targetId, status: 'PUBLISHED' };
        }

        // -------------------------------------------------------------------------
        // FAILED path
        //
        // Retry-increment loop-safety: increment retryCount FIRST, then decide.
        // See JSDoc on this method for the full rationale.
        // -------------------------------------------------------------------------
        const currentRetryCount = (target.retryCount as number | undefined) ?? 0;
        // Increment first — this is what prevents the infinite cron ↔ callback loop
        const newRetryCount = currentRetryCount + 1;

        if (newRetryCount < MAX_RETRY_COUNT) {
            // --- Retry branch: reset target to APPROVED for next cron cycle ---
            await this.targetModel.update(
                { id: targetId },
                {
                    status: SocialPostStatusEnum.APPROVED,
                    lastErrorMessage: errorMessage ?? null,
                    retryCount: newRetryCount
                }
            );

            await this.publishLogModel.create({
                socialPostId: postId,
                socialPostTargetId: targetId,
                platform,
                publishFormat,
                status: SocialPublishResultStatusEnum.FAILED,
                message: errorMessage ?? 'Make reported failure',
                makeRunId: makeRunId ?? null,
                responsePayloadJson: null
            });

            await this.auditLog.log({
                eventType: SocialAuditEvent.TARGET_PUBLISH_FAILED,
                entityType: 'social_post_target',
                entityId: targetId,
                metadata: {
                    postId,
                    retryCount: newRetryCount,
                    error: errorMessage ?? null
                }
            });

            serviceLogger.info(
                { targetId, postId, newRetryCount, error: errorMessage },
                'SocialPublishDispatchService.handleMakeCallbackResult: target FAILED; retry scheduled'
            );

            // NOT terminal — do not cascade post status
            return { targetId, status: 'APPROVED' };
        }

        // --- Exhaustion branch: newRetryCount >= MAX_RETRY_COUNT → FAILED terminal ---
        await this.targetModel.update(
            { id: targetId },
            {
                status: SocialPostStatusEnum.FAILED,
                lastErrorMessage: errorMessage ?? null,
                retryCount: newRetryCount
            }
        );

        await this.publishLogModel.create({
            socialPostId: postId,
            socialPostTargetId: targetId,
            platform,
            publishFormat,
            status: SocialPublishResultStatusEnum.FAILED,
            message: errorMessage ?? 'Make reported failure; max retries reached',
            makeRunId: makeRunId ?? null,
            responsePayloadJson: null
        });

        await this.auditLog.log({
            eventType: SocialAuditEvent.TARGET_PUBLISH_FAILED,
            entityType: 'social_post_target',
            entityId: targetId,
            metadata: {
                postId,
                retryCount: newRetryCount,
                error: errorMessage ?? null
            }
        });

        // Cascade — this failed target may be the last one; cascade decides post fate
        await this.cascadePostStatus({ postId });

        serviceLogger.warn(
            { targetId, postId, newRetryCount, error: errorMessage },
            'SocialPublishDispatchService.handleMakeCallbackResult: target exhausted — FAILED'
        );

        return { targetId, status: 'FAILED' };
    }

    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------

    /**
     * Checks whether all sibling targets of the post (excluding the just-failed
     * target whose DB state was already updated by the caller) are in a terminal
     * state (PUBLISHED or FAILED). If so, sets the post-level status to FAILED.
     *
     * This implements the US-11 exhaustion cascade: when every target of a post
     * has terminated without a single PUBLISHED result, the post itself transitions
     * to FAILED.
     *
     * @param params - Post ID and the target ID to exclude from the freshness check
     *                 (its status was just set to FAILED in the DB but may not yet
     *                 be reflected in a fresh findAll result due to caching).
     */
    private async checkAndCascadePostFailure({
        postId,
        excludeTargetId
    }: {
        readonly postId: string;
        readonly excludeTargetId: string;
    }): Promise<void> {
        const { items: siblings } = await this.targetModel.findAll(
            { socialPostId: postId },
            { page: 1, pageSize: 1000 }
        );

        const allTerminal = siblings.every((sibling) => {
            const siblingId = sibling.id as string | undefined;
            const siblingStatus = sibling.status as string | undefined;

            // The just-failed target was already set to FAILED in the DB before
            // this call, so its status from findAll should already be FAILED.
            // We treat it as FAILED explicitly to guard against any read-after-write
            // consistency lag.
            if (siblingId === excludeTargetId) {
                return true;
            }

            return siblingStatus !== undefined && CASCADE_TERMINAL_STATUSES.has(siblingStatus);
        });

        if (allTerminal) {
            await this.postModel.update({ id: postId }, { status: SocialPostStatusEnum.FAILED });

            serviceLogger.warn(
                { postId },
                'SocialPublishDispatchService: all targets exhausted — post set to FAILED'
            );
        }
    }

    /**
     * Computes the next monthly occurrence from `now`.
     *
     * Returns the same calendar day-of-month in the following month. If the
     * target month is shorter than the source day (e.g. Jan 31 → Feb), the
     * result is clamped to the last day of the target month (Feb 28 / 29).
     *
     * The time-of-day component is preserved from `now` (UTC milliseconds).
     *
     * @param now - Reference point for computation.
     * @returns Date one calendar month after `now`, clamped to month length.
     */
    private computeNextMonthlyDate(now: Date): Date {
        const srcYear = now.getUTCFullYear();
        const srcMonth = now.getUTCMonth(); // 0-indexed
        const srcDay = now.getUTCDate();
        const srcHours = now.getUTCHours();
        const srcMinutes = now.getUTCMinutes();
        const srcSeconds = now.getUTCSeconds();
        const srcMs = now.getUTCMilliseconds();

        // Target: one month ahead
        const targetMonth = (srcMonth + 1) % 12;
        const targetYear = srcMonth === 11 ? srcYear + 1 : srcYear;

        // Last day of target month: use day=0 of the month AFTER target
        const lastDayOfTargetMonth = new Date(
            Date.UTC(targetYear, targetMonth + 1, 0)
        ).getUTCDate();

        const clampedDay = Math.min(srcDay, lastDayOfTargetMonth);

        return new Date(
            Date.UTC(targetYear, targetMonth, clampedDay, srcHours, srcMinutes, srcSeconds, srcMs)
        );
    }

    /**
     * Computes the next occurrence of a given weekday at or after `now`, using
     * the post's IANA `timezone` to determine the local weekday.
     *
     * ## Algorithm
     * 1. Use `Intl.DateTimeFormat` with the post's `timezone` to extract the
     *    current weekday in local time (as a locale-independent `weekday: 'long'`
     *    string in English locale).
     * 2. Map both the current local weekday and the target weekday to 0–6
     *    (Sunday = 0, Monday = 1, …, Saturday = 6).
     * 3. Compute `daysToAdd = (target - current + 7) % 7`.
     *    - If `daysToAdd === 0`, the target weekday is TODAY in the post's timezone,
     *      so the next run is `now` itself (same-day publish is valid per spec).
     * 4. Add `daysToAdd` days (86 400 000 ms each) to `now` in UTC.
     *
     * This is purely UTC math after the initial weekday lookup, so daylight-saving
     * transitions do not affect correctness (the returned Date is in UTC).
     *
     * @param params.now         - Reference time for the computation.
     * @param params.weekdayName - Uppercase weekday name, e.g. `"MONDAY"`.
     * @param params.timezone    - IANA timezone string, e.g. `"America/Argentina/Buenos_Aires"`.
     * @returns UTC Date for the next occurrence of the requested weekday.
     */
    private computeNextWeeklyDate({
        now,
        weekdayName,
        timezone
    }: {
        readonly now: Date;
        readonly weekdayName: string;
        readonly timezone: string;
    }): Date {
        // Map uppercase weekday names to 0-based Sunday-first indices
        const WEEKDAY_INDEX: Record<string, number> = {
            SUNDAY: 0,
            MONDAY: 1,
            TUESDAY: 2,
            WEDNESDAY: 3,
            THURSDAY: 4,
            FRIDAY: 5,
            SATURDAY: 6
        };

        // Map English long weekday names (from Intl) to 0-based indices
        const INTL_WEEKDAY_INDEX: Record<string, number> = {
            Sunday: 0,
            Monday: 1,
            Tuesday: 2,
            Wednesday: 3,
            Thursday: 4,
            Friday: 5,
            Saturday: 6
        };

        // Determine the current weekday in the post's local timezone
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            weekday: 'long'
        });
        const localWeekdayName = formatter.format(now);
        const currentIndex = INTL_WEEKDAY_INDEX[localWeekdayName] ?? 0;
        const targetIndex = WEEKDAY_INDEX[weekdayName] ?? 1; // default Monday

        const daysToAdd = (targetIndex - currentIndex + 7) % 7;

        return new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    }
}
