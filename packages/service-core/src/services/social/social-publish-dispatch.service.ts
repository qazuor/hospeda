/**
 * @file social-publish-dispatch.service.ts
 *
 * Eligibility query, payload assembly, and HTTP dispatch for the Make.com
 * social publishing pipeline.
 *
 * This service provides three methods consumed by the
 * `social-publish-dispatch` cron job:
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
 *    optimistic lock, retry logic, and exhaustion cascade (US-11). The
 *    Make callbacks (T-047) and general recurrence cascade (T-046) are NOT
 *    handled here.
 *
 * This service does NOT extend BaseCrudService.
 * It has NO actor / permission gate — it is always called from cron/system
 * context, never directly from a user-facing API route.
 *
 * @see SPEC-254 T-044 / T-045 / US-11
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
import { SocialPostStatusEnum, SocialPublishResultStatusEnum } from '@repo/schemas';
import type { ServiceConfig } from '../../types';
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
 *   and retry/exhaustion logic (US-11). DOES NOT handle Make result callbacks
 *   (T-047) or general recurrence cascade (T-046).
 *
 * ## What this service does NOT do
 * - No Make result callbacks (T-047).
 * - No general cascade / recurrence reset (T-046).
 * - No permission gate (cron / system context; no actor).
 *
 * SPEC-254 T-044 / T-045.
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
            requestPayloadJson: payload as unknown as Record<string, unknown>
        });

        serviceLogger.info(
            { targetId, postId, newRetryCount, error: failureMessage },
            'SocialPublishDispatchService.dispatchTarget: dispatch failed; retry scheduled'
        );

        return { outcome: 'retry_scheduled', retryCount: newRetryCount };
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
}
