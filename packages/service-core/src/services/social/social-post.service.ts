/**
 * @file social-post.service.ts
 *
 * Non-CRUD editorial state-machine service for social posts.
 *
 * Handles the approval workflow and read/write operations for posts in the
 * social publishing pipeline:
 *  - `approve`         — transitions NEEDS_REVIEW → APPROVED (with media check).
 *  - `reject`          — marks a NEEDS_REVIEW post as REJECTED, appends reason to notes.
 *  - `requestChanges`  — marks a NEEDS_REVIEW post as CHANGES_REQUESTED, appends feedback.
 *  - `schedule`        — schedules an APPROVED post for future publication.
 *  - `markReady`       — marks an APPROVED post as READY_TO_PUBLISH immediately.
 *  - `pause`           — pauses a post to prevent dispatch.
 *  - `unpause`         — unpauses a previously paused post.
 *  - `archive`         — archives (soft-deletes) a post.
 *  - `listPosts`       — paginated list with filters (US-4).
 *  - `getPostDetail`   — full post detail with related data (US-4).
 *  - `updatePost`      — content PATCH for whitelisted fields.
 *  - `promoteHashtag`  — promotes a hashtag to the catalog and links it (US-3).
 *
 * This service does NOT extend BaseCrudService.
 *
 * @see SPEC-254 T-033 / T-034 / T-035
 */

import type {
    SocialAssetModel as SocialAssetModelType,
    SocialHashtagModel as SocialHashtagModelType,
    SocialPlatformFormatModel as SocialPlatformFormatModelType,
    SocialPostHashtagModel as SocialPostHashtagModelType,
    SocialPostMediaModel as SocialPostMediaModelType,
    SocialPostModel as SocialPostModelType,
    SocialPostTargetModel as SocialPostTargetModelType,
    SocialPublishLogModel as SocialPublishLogModelType,
    SocialSettingModel as SocialSettingModelType
} from '@repo/db';
import {
    SocialAssetModel,
    SocialHashtagModel,
    SocialPlatformFormatModel,
    SocialPostHashtagModel,
    SocialPostMediaModel,
    SocialPostModel,
    SocialPostTargetModel,
    SocialPublishLogModel,
    SocialSettingModel,
    gte,
    lte,
    safeIlike,
    socialPosts,
    socialPublishLogs
} from '@repo/db';
import {
    PermissionEnum,
    ServiceErrorCode,
    SocialApprovalStatusEnum,
    SocialPostStatusEnum,
    SocialPublishResultStatusEnum
} from '@repo/schemas';
import type { ServiceConfig, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import type { Actor } from '../../types';
import { hasPermission } from '../../utils/permission';
import { serviceLogger } from '../../utils/service-logger';
import { SocialAuditEvent, SocialAuditLogService } from './social-audit-log.service';
import type { SocialAuditLogService as SocialAuditLogServiceType } from './social-audit-log.service';
import { normalizeHashtag } from './social.helpers';
import {
    checkCanApprovePost,
    checkCanArchivePost,
    checkCanManageHashtag,
    checkCanPausePost,
    checkCanSchedulePost,
    checkCanUpdatePost,
    checkCanViewPost
} from './social.permissions';

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/**
 * List-item shape returned by {@link SocialPostService.listPosts}.
 * Minimal projection for admin list views.
 */
export interface SocialPostListItem {
    /** UUID of the post. */
    readonly id: string;
    /** Human-readable title. */
    readonly title: string;
    /** URL-safe slug. */
    readonly slug: string;
    /** Current pipeline status. */
    readonly status: string;
    /** Current approval status. */
    readonly approvalStatus: string;
    /** Whether the post is paused. */
    readonly paused: boolean;
    /** Platforms this post targets (derived from social_post_targets). */
    readonly platforms: string[];
    /**
     * Cloudinary URL of the first media asset (position 0), or null when
     * the post has no media or the asset has no cloudinary URL yet.
     */
    readonly thumbnailUrl: string | null;
    /** Scheduled publication datetime, or null. */
    readonly scheduledAt: Date | null;
    /** Row creation timestamp. */
    readonly createdAt: Date;
}

/**
 * Pagination result for {@link SocialPostService.listPosts}.
 */
export interface SocialPostListResult {
    /** Page items. */
    readonly items: SocialPostListItem[];
    /** Total matching rows (before pagination). */
    readonly total: number;
}

/**
 * Warning attached to a service result to convey non-blocking advisory info.
 */
export interface ServiceWarning {
    /** Dotted field path that the warning relates to. */
    readonly field: string;
    /** Human-readable advisory message. */
    readonly message: string;
}

/**
 * Full detail shape returned by {@link SocialPostService.getPostDetail}.
 * Extends the raw post row with resolved related collections.
 */
export interface SocialPostDetail {
    /** Post UUID. */
    readonly id: string;
    readonly title: string;
    readonly slug: string;
    readonly status: string;
    readonly approvalStatus: string;
    readonly paused: boolean;
    readonly scheduledAt: Date | null;
    readonly captionBase: string;
    readonly finalCaption: string | null;
    readonly finalHashtagsText: string | null;
    readonly notes: string | null;
    readonly internalNotes: string | null;
    readonly gptHashtagPayloadJson: string[] | null;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    /** All social_post_targets rows for this post. */
    readonly targets: ReadonlyArray<Record<string, unknown>>;
    /** All social_post_media rows, each enriched with the asset's cloudinaryUrl. */
    readonly media: ReadonlyArray<Record<string, unknown>>;
    /** Resolved hashtag text strings (from social_hashtags via social_post_hashtags). */
    readonly hashtags: string[];
    /** Last 10 social_publish_logs for this post (newest first). */
    readonly publishLogs: ReadonlyArray<Record<string, unknown>>;
}

/**
 * Data returned by {@link SocialPostService.promoteHashtag}.
 */
export interface PromoteHashtagData {
    /** UUID of the hashtag record (existing or newly created). */
    readonly hashtagId: string;
    /** Normalized hashtag string (lowercase, `#`-prefixed). */
    readonly hashtag: string;
    /** True when a new social_hashtags row was created; false when it already existed. */
    readonly isNew: boolean;
    /** Non-blocking advisory warnings (e.g. auto-prepended `#` prefix). */
    readonly warnings: ServiceWarning[];
}

/**
 * Data returned by approval state-transition methods.
 */
export interface SocialPostTransitionData {
    /** UUID of the affected post. */
    readonly id: string;
    /** Status after the transition. */
    readonly status: string;
    /** Approval status after the transition. */
    readonly approvalStatus: string;
}

/**
 * Data returned by scheduling state-transition methods.
 */
export interface SocialPostScheduleData {
    /** UUID of the affected post. */
    readonly id: string;
    /** Status after the transition. */
    readonly status: string;
    /** Scheduled datetime after the transition. */
    readonly scheduledAt: Date | null;
}

/**
 * Data returned by markReady.
 */
export interface SocialPostReadyData {
    /** UUID of the affected post. */
    readonly id: string;
    /** Status after the transition. */
    readonly status: string;
}

/**
 * Data returned by pause/unpause methods.
 */
export interface SocialPostPauseData {
    /** UUID of the affected post. */
    readonly id: string;
    /** Paused flag after the transition. */
    readonly paused: boolean;
}

/**
 * Data returned by archive.
 */
export interface SocialPostArchiveData {
    /** UUID of the affected post. */
    readonly id: string;
    /** Status after the transition (always ARCHIVED). */
    readonly status: string;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/**
 * Input for {@link SocialPostService.approve}.
 */
export interface ApprovePostInput {
    /** Actor performing the action — must hold SOCIAL_POST_APPROVE. */
    readonly actor: import('../../types').Actor;
    /** UUID of the post to approve. */
    readonly postId: string;
}

/**
 * Input for {@link SocialPostService.reject}.
 */
export interface RejectPostInput {
    /** Actor performing the action — must hold SOCIAL_POST_APPROVE. */
    readonly actor: import('../../types').Actor;
    /** UUID of the post to reject. */
    readonly postId: string;
    /**
     * Rejection reason (non-empty). Appended to `notes`; existing notes preserved.
     */
    readonly reason: string;
}

/**
 * Input for {@link SocialPostService.requestChanges}.
 */
export interface RequestChangesInput {
    /** Actor performing the action — must hold SOCIAL_POST_APPROVE. */
    readonly actor: import('../../types').Actor;
    /** UUID of the post to request changes on. */
    readonly postId: string;
    /**
     * Change-request feedback (non-empty). Appended to `notes`; existing notes preserved.
     */
    readonly feedback: string;
}

/**
 * Input for {@link SocialPostService.schedule}.
 */
export interface SchedulePostInput {
    /** Actor performing the action — must hold SOCIAL_POST_SCHEDULE. */
    readonly actor: import('../../types').Actor;
    /** UUID of the post to schedule. */
    readonly postId: string;
    /** Future datetime at which the post should be published. Must be strictly after now. */
    readonly scheduledAt: Date;
    /** IANA timezone string (e.g. "America/Argentina/Buenos_Aires"). */
    readonly timezone: string;
}

/**
 * Input for {@link SocialPostService.markReady}.
 */
export interface MarkReadyPostInput {
    /** Actor performing the action — must hold SOCIAL_POST_SCHEDULE. */
    readonly actor: import('../../types').Actor;
    /** UUID of the post to mark ready. */
    readonly postId: string;
}

/**
 * Input for {@link SocialPostService.pause}.
 */
export interface PausePostInput {
    /** Actor performing the action — must hold SOCIAL_POST_PAUSE. */
    readonly actor: import('../../types').Actor;
    /** UUID of the post to pause. */
    readonly postId: string;
}

/**
 * Input for {@link SocialPostService.unpause}.
 */
export interface UnpausePostInput {
    /** Actor performing the action — must hold SOCIAL_POST_PAUSE. */
    readonly actor: import('../../types').Actor;
    /** UUID of the post to unpause. */
    readonly postId: string;
}

/**
 * Input for {@link SocialPostService.archive}.
 */
export interface ArchivePostInput {
    /** Actor performing the action — must hold SOCIAL_POST_ARCHIVE. */
    readonly actor: Actor;
    /** UUID of the post to archive. */
    readonly postId: string;
}

/**
 * Filters accepted by {@link SocialPostService.listPosts}.
 */
export interface ListPostsFilters {
    /** Page number (1-based, default 1). */
    readonly page?: number;
    /**
     * Page size (default 20, clamped to 100).
     * Requests above 100 are silently clamped.
     */
    readonly pageSize?: number;
    /** Filter by pipeline status. */
    readonly status?: string;
    /** Filter by approval status. */
    readonly approvalStatus?: string;
    /**
     * Filter to posts that have at least one social_post_target on this platform.
     * Resolved via a two-step query: targets → distinct socialPostIds.
     */
    readonly platform?: string;
    /** Substring search on `title` (case-insensitive, via safeIlike). */
    readonly search?: string;
    /** Inclusive lower bound on `createdAt`. */
    readonly createdAtFrom?: Date;
    /** Inclusive upper bound on `createdAt`. */
    readonly createdAtTo?: Date;
    /**
     * Include soft-deleted (archived) posts.
     * Only honoured when the actor holds SOCIAL_POST_HARD_DELETE; otherwise silently forced to false.
     */
    readonly includeDeleted?: boolean;
}

/**
 * Input for {@link SocialPostService.listPosts}.
 */
export interface ListPostsInput {
    /** Actor performing the action — must hold SOCIAL_POST_VIEW. */
    readonly actor: Actor;
    /** Optional filter set. Defaults applied when omitted. */
    readonly filters?: ListPostsFilters;
}

/**
 * Input for {@link SocialPostService.getPostDetail}.
 */
export interface GetPostDetailInput {
    /** Actor performing the action — must hold SOCIAL_POST_VIEW. */
    readonly actor: Actor;
    /** UUID of the post to retrieve. */
    readonly postId: string;
}

/**
 * Whitelisted fields that {@link SocialPostService.updatePost} accepts.
 * Status, approvalStatus, paused, and all soft-delete/audit fields are stripped.
 */
export interface UpdatePostData {
    readonly title?: string;
    readonly captionBase?: string;
    readonly finalCaption?: string;
    readonly finalHashtagsText?: string;
    readonly notes?: string;
    readonly internalNotes?: string;
    readonly footerId?: string;
    readonly campaignId?: string;
    readonly batchId?: string;
    readonly audienceId?: string;
    readonly batchPosition?: number;
}

/**
 * Input for {@link SocialPostService.updatePost}.
 */
export interface UpdatePostInput {
    /** Actor performing the action — must hold SOCIAL_POST_UPDATE. */
    readonly actor: Actor;
    /** UUID of the post to update. */
    readonly postId: string;
    /** Fields to update (only whitelisted fields are applied). */
    readonly data: UpdatePostData;
}

/**
 * KPI counters returned by {@link SocialPostService.getDashboard}.
 */
export interface SocialDashboardKpis {
    readonly totalPosts: number;
    readonly pendingReview: number;
    readonly scheduled: number;
    readonly publishedLast30Days: number;
    readonly failedActionNeeded: number;
}

/**
 * Quick-approval queue item returned by {@link SocialPostService.getDashboard}.
 */
export interface SocialDashboardQueueItem {
    readonly id: string;
    readonly title: string;
    readonly status: string;
    readonly platforms: string[];
    readonly thumbnailUrl: string | null;
    readonly createdAt: Date;
}

/**
 * Recent failure item returned by {@link SocialPostService.getDashboard}.
 * Sourced from social_post_targets rows with FAILED status.
 */
export interface SocialDashboardFailureItem {
    readonly targetId: string;
    readonly postTitle: string;
    readonly platform: string;
    readonly lastError: string | null;
    readonly retryCount: number;
    readonly failedAt: Date;
}

/**
 * Data returned by {@link SocialPostService.getDashboard}.
 */
export interface SocialDashboardData {
    readonly kpis: SocialDashboardKpis;
    readonly quickApprovalQueue: SocialDashboardQueueItem[];
    readonly recentFailures: SocialDashboardFailureItem[];
    readonly makeWebhookConfigured: boolean;
}

/**
 * Input for {@link SocialPostService.getDashboard}.
 */
export interface GetDashboardInput {
    /** Actor performing the action — must hold SOCIAL_POST_VIEW. */
    readonly actor: Actor;
}

/**
 * Input for {@link SocialPostService.promoteHashtag}.
 */
export interface PromoteHashtagInput {
    /** Actor performing the action — must hold SOCIAL_HASHTAG_MANAGE. */
    readonly actor: Actor;
    /** UUID of the post to link the hashtag to. */
    readonly postId: string;
    /**
     * Raw hashtag string as entered by the user.
     * A missing `#` prefix is auto-prepended (with a warning returned).
     */
    readonly hashtag: string;
    /** Category label for a newly created hashtag. */
    readonly category: string;
    /** Optional platform association for a newly created hashtag. */
    readonly platform?: string;
    /** Optional audience UUID for a newly created hashtag. */
    readonly audienceId?: string;
    /** Optional priority for a newly created hashtag (default 0). */
    readonly priority?: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Editorial state-machine and read/write service for social posts.
 *
 * ## Responsibilities
 * - Enforces permission checks per method.
 * - Guards state transitions (posts must be in the correct state to advance).
 * - Runs a media-presence check before approval when any target requires media.
 * - Updates the post row on every transition.
 * - Emits an audit log row on every successful transition or catalog mutation.
 * - Provides paginated list, full-detail read, content PATCH, and hashtag promotion.
 *
 * ## Error codes used
 * | ServiceErrorCode     | Machine string       | HTTP | When                                          |
 * |----------------------|----------------------|------|-----------------------------------------------|
 * | FORBIDDEN            | FORBIDDEN            | 403  | Actor lacks the required permission           |
 * | NOT_FOUND            | NOT_FOUND            | 404  | Post does not exist (or is soft-deleted)      |
 * | VALIDATION_ERROR     | VALIDATION_ERROR     | 422  | reason / feedback blank or scheduledAt past   |
 * | VALIDATION_ERROR     | INVALID_STATE        | 422  | Post is not in the expected state             |
 * | VALIDATION_ERROR     | MISSING_MEDIA        | 422  | No media but a target requires media          |
 *
 * For INVALID_STATE and MISSING_MEDIA there is no dedicated ServiceErrorCode member,
 * so VALIDATION_ERROR is reused as the `code` (the closest existing 422 code).
 * The machine-readable discriminator is carried in the `reason` field of ServiceError,
 * which propagates to the API error response payload and lets the route (T-036) map
 * each case to the correct response shape without parsing the human message.
 *
 * SPEC-254 T-033 / T-034 / T-035.
 */
export class SocialPostService {
    private readonly postModel: SocialPostModelType;
    private readonly postTargetModel: SocialPostTargetModelType;
    private readonly postMediaModel: SocialPostMediaModelType;
    private readonly platformFormatModel: SocialPlatformFormatModelType;
    private readonly hashtagModel: SocialHashtagModelType;
    private readonly postHashtagModel: SocialPostHashtagModelType;
    private readonly assetModel: SocialAssetModelType;
    private readonly publishLogModel: SocialPublishLogModelType;
    private readonly settingModel: SocialSettingModelType;
    private readonly auditLog: SocialAuditLogServiceType;

    constructor(
        config: ServiceConfig,
        postModel?: SocialPostModelType,
        postTargetModel?: SocialPostTargetModelType,
        postMediaModel?: SocialPostMediaModelType,
        platformFormatModel?: SocialPlatformFormatModelType,
        auditLog?: SocialAuditLogServiceType,
        hashtagModel?: SocialHashtagModelType,
        postHashtagModel?: SocialPostHashtagModelType,
        assetModel?: SocialAssetModelType,
        publishLogModel?: SocialPublishLogModelType,
        settingModel?: SocialSettingModelType
    ) {
        this.postModel = postModel ?? new SocialPostModel();
        this.postTargetModel = postTargetModel ?? new SocialPostTargetModel();
        this.postMediaModel = postMediaModel ?? new SocialPostMediaModel();
        this.platformFormatModel = platformFormatModel ?? new SocialPlatformFormatModel();
        this.hashtagModel = hashtagModel ?? new SocialHashtagModel();
        this.postHashtagModel = postHashtagModel ?? new SocialPostHashtagModel();
        this.assetModel = assetModel ?? new SocialAssetModel();
        this.publishLogModel = publishLogModel ?? new SocialPublishLogModel();
        this.settingModel = settingModel ?? new SocialSettingModel();
        this.auditLog = auditLog ?? new SocialAuditLogService(config);
    }

    // ---------------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------------

    /**
     * Approves a post that is in NEEDS_REVIEW state.
     *
     * Steps:
     * 1. Permission check — SOCIAL_POST_APPROVE required.
     * 2. Load the post (non-soft-deleted).
     * 3. State guard — post must have `status = NEEDS_REVIEW`.
     * 4. Media check — if the post has no media rows AND at least one of its
     *    targets points at a platform-format with `requiresMedia = true`, the
     *    approval is rejected with MISSING_MEDIA.
     * 5. DB update — status=APPROVED, approvalStatus=APPROVED, approvedById, approvedAt, updatedById.
     * 6. Audit log.
     *
     * @param input - Actor + postId.
     * @returns ServiceOutput with `{ id, status, approvalStatus }` on success.
     *
     * @example
     * ```ts
     * const result = await service.approve({ actor, postId: 'uuid' });
     * if (result.error) {
     *   // handle error.code / error.reason
     * }
     * ```
     */
    public async approve(
        input: ApprovePostInput
    ): Promise<ServiceOutput<SocialPostTransitionData>> {
        const { actor, postId } = input;

        try {
            // Step 1: Permission
            checkCanApprovePost(actor);

            // Step 2: Load post
            const post = await this.postModel.findOne({ id: postId, deletedAt: null });
            if (!post) {
                throw new ServiceError(ServiceErrorCode.NOT_FOUND, `Post not found: ${postId}`);
            }

            // Step 3: State guard — must be NEEDS_REVIEW
            if (post.status !== SocialPostStatusEnum.NEEDS_REVIEW) {
                throw new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    'Post must be in NEEDS_REVIEW to approve',
                    undefined,
                    'INVALID_STATE'
                );
            }

            // Step 4: Media check
            // Load targets for this post, then load their platform-format rows.
            // If ANY platform-format has requiresMedia=true and the post has no media, block.
            const { items: targets } = await this.postTargetModel.findAll({
                socialPostId: postId
            });

            if (targets.length > 0) {
                // Collect unique platformFormatIds referenced by the targets
                const platformFormatIds = [
                    ...new Set(
                        targets
                            .map((t) => t.platformFormatId as string | undefined)
                            .filter((id): id is string => typeof id === 'string')
                    )
                ];

                const requiresMedia = await this.anyFormatRequiresMedia(platformFormatIds);

                if (requiresMedia) {
                    const { items: mediaRows } = await this.postMediaModel.findAll({
                        socialPostId: postId
                    });

                    if (mediaRows.length === 0) {
                        throw new ServiceError(
                            ServiceErrorCode.VALIDATION_ERROR,
                            'Post has no media but targets require it',
                            undefined,
                            'MISSING_MEDIA'
                        );
                    }
                }
            }

            // Step 5: Update post
            const now = new Date();
            const updated = await this.postModel.update(
                { id: postId },
                {
                    status: SocialPostStatusEnum.APPROVED,
                    approvalStatus: SocialApprovalStatusEnum.APPROVED,
                    approvedById: actor.id,
                    approvedAt: now,
                    updatedById: actor.id
                }
            );

            if (!updated) {
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    `Failed to update post: ${postId}`
                );
            }

            // Step 6: Audit log
            await this.auditLog.log({
                actorId: actor.id,
                eventType: SocialAuditEvent.POST_APPROVED,
                entityType: 'social_post',
                entityId: postId,
                oldValue: {
                    status: SocialPostStatusEnum.NEEDS_REVIEW,
                    approvalStatus: SocialApprovalStatusEnum.PENDING
                },
                newValue: {
                    status: SocialPostStatusEnum.APPROVED,
                    approvalStatus: SocialApprovalStatusEnum.APPROVED
                }
            });

            serviceLogger.info(
                { postId, actorId: actor.id },
                'SocialPostService.approve: post approved'
            );

            return {
                data: {
                    id: postId,
                    status: SocialPostStatusEnum.APPROVED,
                    approvalStatus: SocialApprovalStatusEnum.APPROVED
                }
            };
        } catch (err) {
            if (err instanceof ServiceError) {
                return {
                    error: {
                        code: err.code,
                        message: err.message,
                        details: err.details,
                        reason: err.reason
                    }
                };
            }
            const message = err instanceof Error ? err.message : String(err);
            serviceLogger.error(
                { postId, error: message },
                'SocialPostService.approve: unexpected error'
            );
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: `Unexpected error during approve: ${message}`
                }
            };
        }
    }

    /**
     * Rejects a post that is in NEEDS_REVIEW / PENDING state.
     *
     * Steps:
     * 1. Permission check — SOCIAL_POST_APPROVE required.
     * 2. Validate `reason` is non-empty.
     * 3. Load the post (non-soft-deleted).
     * 4. State guard — post must have status=NEEDS_REVIEW and approvalStatus=PENDING.
     * 5. DB update — approvalStatus=REJECTED, notes appended with reason, updatedById.
     *    (`status` stays NEEDS_REVIEW — the post is not deleted or archived.)
     * 6. Audit log.
     *
     * @param input - Actor, postId, and rejection reason.
     * @returns ServiceOutput with `{ id, status, approvalStatus }` on success.
     */
    public async reject(input: RejectPostInput): Promise<ServiceOutput<SocialPostTransitionData>> {
        const { actor, postId, reason } = input;

        try {
            // Step 1: Permission
            checkCanApprovePost(actor);

            // Step 2: Validate reason
            if (!reason || reason.trim().length === 0) {
                throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'reason is required');
            }

            // Step 3: Load post
            const post = await this.postModel.findOne({ id: postId, deletedAt: null });
            if (!post) {
                throw new ServiceError(ServiceErrorCode.NOT_FOUND, `Post not found: ${postId}`);
            }

            // Step 4: State guard — must be NEEDS_REVIEW + PENDING
            if (
                post.status !== SocialPostStatusEnum.NEEDS_REVIEW ||
                post.approvalStatus !== SocialApprovalStatusEnum.PENDING
            ) {
                throw new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    'Post must be in NEEDS_REVIEW / PENDING to reject',
                    undefined,
                    'INVALID_STATE'
                );
            }

            // Step 5: Update post — append reason to notes, preserve existing
            const existingNotes = typeof post.notes === 'string' ? post.notes : null;
            const newNotes = buildAppendedNotes(existingNotes, reason.trim());

            const updated = await this.postModel.update(
                { id: postId },
                {
                    approvalStatus: SocialApprovalStatusEnum.REJECTED,
                    notes: newNotes,
                    updatedById: actor.id
                }
            );

            if (!updated) {
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    `Failed to update post: ${postId}`
                );
            }

            // Step 6: Audit log
            await this.auditLog.log({
                actorId: actor.id,
                eventType: SocialAuditEvent.POST_REJECTED,
                entityType: 'social_post',
                entityId: postId,
                oldValue: { approvalStatus: SocialApprovalStatusEnum.PENDING },
                newValue: { approvalStatus: SocialApprovalStatusEnum.REJECTED },
                metadata: { reason: reason.trim() }
            });

            serviceLogger.info(
                { postId, actorId: actor.id },
                'SocialPostService.reject: post rejected'
            );

            return {
                data: {
                    id: postId,
                    status: SocialPostStatusEnum.NEEDS_REVIEW,
                    approvalStatus: SocialApprovalStatusEnum.REJECTED
                }
            };
        } catch (err) {
            if (err instanceof ServiceError) {
                return {
                    error: {
                        code: err.code,
                        message: err.message,
                        details: err.details,
                        reason: err.reason
                    }
                };
            }
            const message = err instanceof Error ? err.message : String(err);
            serviceLogger.error(
                { postId, error: message },
                'SocialPostService.reject: unexpected error'
            );
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: `Unexpected error during reject: ${message}`
                }
            };
        }
    }

    /**
     * Requests changes on a post that is in NEEDS_REVIEW / PENDING state.
     *
     * This action keeps the post in NEEDS_REVIEW status but advances the
     * approvalStatus to CHANGES_REQUESTED so that the content creator knows
     * revisions are needed before a re-review.
     *
     * Steps:
     * 1. Permission check — SOCIAL_POST_APPROVE required.
     * 2. Validate `feedback` is non-empty.
     * 3. Load the post (non-soft-deleted).
     * 4. State guard (safety interpretation) — apply the same NEEDS_REVIEW/PENDING
     *    guard as `reject`. A post that is already published or archived cannot have
     *    changes requested; this prevents accidental state pollution on terminal posts.
     * 5. DB update — approvalStatus=CHANGES_REQUESTED, notes appended with feedback,
     *    updatedById. (`status` unchanged.)
     * 6. Audit log.
     *
     * @param input - Actor, postId, and change-request feedback.
     * @returns ServiceOutput with `{ id, status, approvalStatus }` on success.
     */
    public async requestChanges(
        input: RequestChangesInput
    ): Promise<ServiceOutput<SocialPostTransitionData>> {
        const { actor, postId, feedback } = input;

        try {
            // Step 1: Permission
            checkCanApprovePost(actor);

            // Step 2: Validate feedback
            if (!feedback || feedback.trim().length === 0) {
                throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'feedback is required');
            }

            // Step 3: Load post
            const post = await this.postModel.findOne({ id: postId, deletedAt: null });
            if (!post) {
                throw new ServiceError(ServiceErrorCode.NOT_FOUND, `Post not found: ${postId}`);
            }

            // Step 4: State guard — safety: only allow on NEEDS_REVIEW/PENDING.
            // This prevents accidentally requesting changes on published/archived posts.
            if (
                post.status !== SocialPostStatusEnum.NEEDS_REVIEW ||
                post.approvalStatus !== SocialApprovalStatusEnum.PENDING
            ) {
                throw new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    'Post must be in NEEDS_REVIEW / PENDING to request changes',
                    undefined,
                    'INVALID_STATE'
                );
            }

            // Step 5: Update post — append feedback to notes, preserve existing
            const existingNotes = typeof post.notes === 'string' ? post.notes : null;
            const newNotes = buildAppendedNotes(existingNotes, feedback.trim());

            const updated = await this.postModel.update(
                { id: postId },
                {
                    approvalStatus: SocialApprovalStatusEnum.CHANGES_REQUESTED,
                    notes: newNotes,
                    updatedById: actor.id
                }
            );

            if (!updated) {
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    `Failed to update post: ${postId}`
                );
            }

            // Step 6: Audit log
            await this.auditLog.log({
                actorId: actor.id,
                eventType: SocialAuditEvent.POST_CHANGES_REQUESTED,
                entityType: 'social_post',
                entityId: postId,
                oldValue: { approvalStatus: SocialApprovalStatusEnum.PENDING },
                newValue: { approvalStatus: SocialApprovalStatusEnum.CHANGES_REQUESTED },
                metadata: { feedback: feedback.trim() }
            });

            serviceLogger.info(
                { postId, actorId: actor.id },
                'SocialPostService.requestChanges: changes requested'
            );

            return {
                data: {
                    id: postId,
                    status: post.status as string,
                    approvalStatus: SocialApprovalStatusEnum.CHANGES_REQUESTED
                }
            };
        } catch (err) {
            if (err instanceof ServiceError) {
                return {
                    error: {
                        code: err.code,
                        message: err.message,
                        details: err.details,
                        reason: err.reason
                    }
                };
            }
            const message = err instanceof Error ? err.message : String(err);
            serviceLogger.error(
                { postId, error: message },
                'SocialPostService.requestChanges: unexpected error'
            );
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: `Unexpected error during requestChanges: ${message}`
                }
            };
        }
    }

    /**
     * Schedules an approved post for future publication, or reschedules a post
     * that is already in SCHEDULED state.
     *
     * Steps:
     * 1. Permission check — SOCIAL_POST_SCHEDULE required.
     * 2. Load the post (non-soft-deleted).
     * 3. Validate `scheduledAt` is strictly in the future.
     * 4. State guard — post must be APPROVED (first schedule) or SCHEDULED (reschedule).
     * 5. DB update — status=SCHEDULED (if APPROVED), scheduledAt, timezone, nextRunAt, updatedById.
     * 6. Audit log — POST_SCHEDULED (first time) or POST_RESCHEDULED (update).
     *
     * @param input - Actor, postId, scheduledAt, and timezone.
     * @returns ServiceOutput with `{ id, status, scheduledAt }` on success.
     */
    public async schedule(
        input: SchedulePostInput
    ): Promise<ServiceOutput<SocialPostScheduleData>> {
        const { actor, postId, scheduledAt, timezone } = input;

        try {
            // Step 1: Permission
            checkCanSchedulePost(actor);

            // Step 2: Load post
            const post = await this.postModel.findOne({ id: postId, deletedAt: null });
            if (!post) {
                throw new ServiceError(ServiceErrorCode.NOT_FOUND, `Post not found: ${postId}`);
            }

            // Step 3: Validate scheduledAt is in the future
            if (scheduledAt <= new Date()) {
                throw new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    'scheduledAt must be in the future'
                );
            }

            // Step 4: State guard
            const isFirstSchedule = post.status === SocialPostStatusEnum.APPROVED;
            const isReschedule = post.status === SocialPostStatusEnum.SCHEDULED;

            if (!isFirstSchedule && !isReschedule) {
                throw new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    'Post must be APPROVED or SCHEDULED to schedule',
                    undefined,
                    'INVALID_STATE'
                );
            }

            // Step 5: Update post
            const updated = await this.postModel.update(
                { id: postId },
                {
                    status: SocialPostStatusEnum.SCHEDULED,
                    scheduledAt,
                    timezone,
                    nextRunAt: scheduledAt,
                    updatedById: actor.id
                }
            );

            if (!updated) {
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    `Failed to update post: ${postId}`
                );
            }

            // Step 6: Audit log
            if (isFirstSchedule) {
                await this.auditLog.log({
                    actorId: actor.id,
                    eventType: SocialAuditEvent.POST_SCHEDULED,
                    entityType: 'social_post',
                    entityId: postId,
                    oldValue: { status: SocialPostStatusEnum.APPROVED },
                    newValue: { status: SocialPostStatusEnum.SCHEDULED, scheduledAt }
                });
            } else {
                await this.auditLog.log({
                    actorId: actor.id,
                    eventType: SocialAuditEvent.POST_RESCHEDULED,
                    entityType: 'social_post',
                    entityId: postId,
                    oldValue: { scheduledAt: post.scheduledAt },
                    newValue: { scheduledAt }
                });
            }

            serviceLogger.info(
                { postId, actorId: actor.id, isReschedule },
                'SocialPostService.schedule: post scheduled'
            );

            return {
                data: {
                    id: postId,
                    status: SocialPostStatusEnum.SCHEDULED,
                    scheduledAt
                }
            };
        } catch (err) {
            if (err instanceof ServiceError) {
                return {
                    error: {
                        code: err.code,
                        message: err.message,
                        details: err.details,
                        reason: err.reason
                    }
                };
            }
            const message = err instanceof Error ? err.message : String(err);
            serviceLogger.error(
                { postId, error: message },
                'SocialPostService.schedule: unexpected error'
            );
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: `Unexpected error during schedule: ${message}`
                }
            };
        }
    }

    /**
     * Marks an approved post as READY_TO_PUBLISH so the dispatch cron picks it
     * up on the next run without waiting for a scheduled datetime.
     *
     * Steps:
     * 1. Permission check — SOCIAL_POST_SCHEDULE required.
     * 2. Load the post (non-soft-deleted).
     * 3. State guard — post must be APPROVED.
     * 4. DB update — status=READY_TO_PUBLISH, nextRunAt=now, updatedById.
     * 5. Audit log — POST_MARKED_READY.
     *
     * @param input - Actor and postId.
     * @returns ServiceOutput with `{ id, status }` on success.
     */
    public async markReady(input: MarkReadyPostInput): Promise<ServiceOutput<SocialPostReadyData>> {
        const { actor, postId } = input;

        try {
            // Step 1: Permission
            checkCanSchedulePost(actor);

            // Step 2: Load post
            const post = await this.postModel.findOne({ id: postId, deletedAt: null });
            if (!post) {
                throw new ServiceError(ServiceErrorCode.NOT_FOUND, `Post not found: ${postId}`);
            }

            // Step 3: State guard — must be APPROVED
            if (post.status !== SocialPostStatusEnum.APPROVED) {
                throw new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    'Post must be APPROVED to mark ready',
                    undefined,
                    'INVALID_STATE'
                );
            }

            // Step 4: Update post
            const now = new Date();
            const updated = await this.postModel.update(
                { id: postId },
                {
                    status: SocialPostStatusEnum.READY_TO_PUBLISH,
                    nextRunAt: now,
                    updatedById: actor.id
                }
            );

            if (!updated) {
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    `Failed to update post: ${postId}`
                );
            }

            // Step 5: Audit log
            await this.auditLog.log({
                actorId: actor.id,
                eventType: SocialAuditEvent.POST_MARKED_READY,
                entityType: 'social_post',
                entityId: postId,
                oldValue: { status: SocialPostStatusEnum.APPROVED },
                newValue: { status: SocialPostStatusEnum.READY_TO_PUBLISH }
            });

            serviceLogger.info(
                { postId, actorId: actor.id },
                'SocialPostService.markReady: post marked ready to publish'
            );

            return {
                data: {
                    id: postId,
                    status: SocialPostStatusEnum.READY_TO_PUBLISH
                }
            };
        } catch (err) {
            if (err instanceof ServiceError) {
                return {
                    error: {
                        code: err.code,
                        message: err.message,
                        details: err.details,
                        reason: err.reason
                    }
                };
            }
            const message = err instanceof Error ? err.message : String(err);
            serviceLogger.error(
                { postId, error: message },
                'SocialPostService.markReady: unexpected error'
            );
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: `Unexpected error during markReady: ${message}`
                }
            };
        }
    }

    /**
     * Pauses a post, preventing the dispatch cron from publishing it until unpaused.
     *
     * Steps:
     * 1. Permission check — SOCIAL_POST_PAUSE required.
     * 2. Load the post (non-soft-deleted).
     * 3. State guard — PUBLISHED and FAILED posts cannot be paused.
     * 4. DB update — paused=true, updatedById.
     * 5. Audit log — POST_PAUSED.
     *
     * @param input - Actor and postId.
     * @returns ServiceOutput with `{ id, paused }` on success.
     */
    public async pause(input: PausePostInput): Promise<ServiceOutput<SocialPostPauseData>> {
        const { actor, postId } = input;

        try {
            // Step 1: Permission
            checkCanPausePost(actor);

            // Step 2: Load post
            const post = await this.postModel.findOne({ id: postId, deletedAt: null });
            if (!post) {
                throw new ServiceError(ServiceErrorCode.NOT_FOUND, `Post not found: ${postId}`);
            }

            // Step 3: State guard — PUBLISHED and FAILED cannot be paused
            if (
                post.status === SocialPostStatusEnum.PUBLISHED ||
                post.status === SocialPostStatusEnum.FAILED
            ) {
                throw new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    'Cannot pause a post in PUBLISHED or FAILED state',
                    undefined,
                    'INVALID_STATE'
                );
            }

            // Step 4: Update post
            const updated = await this.postModel.update(
                { id: postId },
                {
                    paused: true,
                    updatedById: actor.id
                }
            );

            if (!updated) {
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    `Failed to update post: ${postId}`
                );
            }

            // Step 5: Audit log
            await this.auditLog.log({
                actorId: actor.id,
                eventType: SocialAuditEvent.POST_PAUSED,
                entityType: 'social_post',
                entityId: postId,
                oldValue: { paused: false },
                newValue: { paused: true }
            });

            serviceLogger.info(
                { postId, actorId: actor.id },
                'SocialPostService.pause: post paused'
            );

            return {
                data: {
                    id: postId,
                    paused: true
                }
            };
        } catch (err) {
            if (err instanceof ServiceError) {
                return {
                    error: {
                        code: err.code,
                        message: err.message,
                        details: err.details,
                        reason: err.reason
                    }
                };
            }
            const message = err instanceof Error ? err.message : String(err);
            serviceLogger.error(
                { postId, error: message },
                'SocialPostService.pause: unexpected error'
            );
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: `Unexpected error during pause: ${message}`
                }
            };
        }
    }

    /**
     * Unpauses a previously paused post, allowing the dispatch cron to resume
     * publishing it.
     *
     * Steps:
     * 1. Permission check — SOCIAL_POST_PAUSE required.
     * 2. Load the post (non-soft-deleted).
     * 3. DB update — paused=false, updatedById.
     * 4. Audit log — POST_UNPAUSED.
     *
     * @param input - Actor and postId.
     * @returns ServiceOutput with `{ id, paused }` on success.
     */
    public async unpause(input: UnpausePostInput): Promise<ServiceOutput<SocialPostPauseData>> {
        const { actor, postId } = input;

        try {
            // Step 1: Permission
            checkCanPausePost(actor);

            // Step 2: Load post
            const post = await this.postModel.findOne({ id: postId, deletedAt: null });
            if (!post) {
                throw new ServiceError(ServiceErrorCode.NOT_FOUND, `Post not found: ${postId}`);
            }

            // Step 3: Update post
            const updated = await this.postModel.update(
                { id: postId },
                {
                    paused: false,
                    updatedById: actor.id
                }
            );

            if (!updated) {
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    `Failed to update post: ${postId}`
                );
            }

            // Step 4: Audit log
            await this.auditLog.log({
                actorId: actor.id,
                eventType: SocialAuditEvent.POST_UNPAUSED,
                entityType: 'social_post',
                entityId: postId,
                oldValue: { paused: true },
                newValue: { paused: false }
            });

            serviceLogger.info(
                { postId, actorId: actor.id },
                'SocialPostService.unpause: post unpaused'
            );

            return {
                data: {
                    id: postId,
                    paused: false
                }
            };
        } catch (err) {
            if (err instanceof ServiceError) {
                return {
                    error: {
                        code: err.code,
                        message: err.message,
                        details: err.details,
                        reason: err.reason
                    }
                };
            }
            const message = err instanceof Error ? err.message : String(err);
            serviceLogger.error(
                { postId, error: message },
                'SocialPostService.unpause: unexpected error'
            );
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: `Unexpected error during unpause: ${message}`
                }
            };
        }
    }

    /**
     * Archives a post by setting `status = ARCHIVED` and soft-deleting the row
     * (`deletedAt`, `deletedById`). Archived posts are excluded from default
     * admin list queries.
     *
     * Posts in PUBLISHING state cannot be archived — the dispatch is already in
     * flight and archiving would corrupt the publish flow.
     *
     * Steps:
     * 1. Permission check — SOCIAL_POST_ARCHIVE required.
     * 2. Load the post (non-soft-deleted).
     * 3. State guard — PUBLISHING posts cannot be archived.
     * 4. DB update (single call) — status=ARCHIVED, deletedAt=now, deletedById, updatedById.
     * 5. Audit log — POST_ARCHIVED.
     *
     * @param input - Actor and postId.
     * @returns ServiceOutput with `{ id, status }` on success.
     */
    public async archive(input: ArchivePostInput): Promise<ServiceOutput<SocialPostArchiveData>> {
        const { actor, postId } = input;

        try {
            // Step 1: Permission
            checkCanArchivePost(actor);

            // Step 2: Load post
            const post = await this.postModel.findOne({ id: postId, deletedAt: null });
            if (!post) {
                throw new ServiceError(ServiceErrorCode.NOT_FOUND, `Post not found: ${postId}`);
            }

            // Step 3: State guard — PUBLISHING cannot be archived (dispatch in flight)
            if (post.status === SocialPostStatusEnum.PUBLISHING) {
                throw new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    'Cannot archive a post that is currently being published',
                    undefined,
                    'INVALID_STATE'
                );
            }

            // Step 4: Single atomic update — status + soft-delete
            const now = new Date();
            const updated = await this.postModel.update(
                { id: postId },
                {
                    status: SocialPostStatusEnum.ARCHIVED,
                    deletedAt: now,
                    deletedById: actor.id,
                    updatedById: actor.id
                }
            );

            if (!updated) {
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    `Failed to update post: ${postId}`
                );
            }

            // Step 5: Audit log
            await this.auditLog.log({
                actorId: actor.id,
                eventType: SocialAuditEvent.POST_ARCHIVED,
                entityType: 'social_post',
                entityId: postId,
                oldValue: { status: post.status },
                newValue: { status: SocialPostStatusEnum.ARCHIVED, deletedAt: now }
            });

            serviceLogger.info(
                { postId, actorId: actor.id },
                'SocialPostService.archive: post archived and soft-deleted'
            );

            return {
                data: {
                    id: postId,
                    status: SocialPostStatusEnum.ARCHIVED
                }
            };
        } catch (err) {
            if (err instanceof ServiceError) {
                return {
                    error: {
                        code: err.code,
                        message: err.message,
                        details: err.details,
                        reason: err.reason
                    }
                };
            }
            const message = err instanceof Error ? err.message : String(err);
            serviceLogger.error(
                { postId, error: message },
                'SocialPostService.archive: unexpected error'
            );
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: `Unexpected error during archive: ${message}`
                }
            };
        }
    }

    /**
     * Returns a paginated list of social posts with optional filters.
     *
     * Permission required: SOCIAL_POST_VIEW.
     *
     * Platform filter strategy (two-step):
     *   1. Query social_post_targets for the given platform → collect distinct socialPostIds.
     *   2. Restrict the post query to only those IDs.
     * This is necessary because the base model findAll does not support JOIN-based filters.
     *
     * Thumbnail and platforms per post are resolved with per-post lookups (N+1).
     * This is noted intentionally — a batch approach would require raw Drizzle queries
     * outside the base model API, which is inconsistent with this service's style.
     * The list is paginated (max 100 rows), so the overhead is bounded.
     *
     * @param input - Actor and optional filters.
     * @returns ServiceOutput containing `{ items, total }`.
     */
    public async listPosts(input: ListPostsInput): Promise<ServiceOutput<SocialPostListResult>> {
        const { actor, filters = {} } = input;

        try {
            // Step 1: Permission
            checkCanViewPost(actor);

            // Step 2: Resolve pagination params
            const page = filters.page ?? 1;
            const rawPageSize = filters.pageSize ?? 20;
            const pageSize = Math.min(rawPageSize, 100);

            // Step 3: includeDeleted is only honoured for actors with SOCIAL_POST_HARD_DELETE
            const canViewDeleted = hasPermission(actor, PermissionEnum.SOCIAL_POST_HARD_DELETE);
            const includeDeleted = canViewDeleted ? (filters.includeDeleted ?? false) : false;

            // Step 4: Resolve the platform filter via social_post_targets (two-step approach)
            // If a platform filter is requested, first find all post IDs that have a target
            // on that platform, then constrain the post query to those IDs.
            let platformPostIds: string[] | null = null;
            if (filters.platform) {
                const { items: targetRows } = await this.postTargetModel.findAll(
                    { platform: filters.platform },
                    { page: 1, pageSize: 2000 }
                );
                if (targetRows.length === 0) {
                    return { data: { items: [], total: 0 } };
                }
                const uniqueIds = [
                    ...new Set(targetRows.map((t) => t.socialPostId as string).filter(Boolean))
                ];
                platformPostIds = uniqueIds;
            }

            // Step 5: Build the where clause for equality-based conditions
            const where: Record<string, unknown> = {};
            if (!includeDeleted) {
                where.deletedAt = null;
            }
            if (filters.status) {
                where.status = filters.status;
            }
            if (filters.approvalStatus) {
                where.approvalStatus = filters.approvalStatus;
            }

            // Step 6: Build additional SQL conditions (safeIlike for title, date range)
            // These use drizzle-orm SQL helpers — safeIlike auto-escapes LIKE wildcards.
            const resolvedConditions = [];

            if (filters.search) {
                resolvedConditions.push(safeIlike(socialPosts.title, filters.search));
            }
            if (filters.createdAtFrom) {
                resolvedConditions.push(gte(socialPosts.createdAt, filters.createdAtFrom));
            }
            if (filters.createdAtTo) {
                resolvedConditions.push(lte(socialPosts.createdAt, filters.createdAtTo));
            }

            // Step 7: Fetch posts
            const { items: posts, total } = await this.postModel.findAll(
                where,
                { page, pageSize },
                resolvedConditions
            );

            // Apply platform ID filter in-memory (base model has no IN() support)
            // NOTE: This secondary in-memory filter is only needed when platform filter is set.
            // The total returned from findAll may be slightly over when combined with platformPostIds;
            // for accurate totals a raw query would be needed. For simplicity, filter post-findAll
            // and recount. The set is bounded by pageSize so this is safe.
            let filteredPosts = posts;
            if (platformPostIds !== null) {
                const idSet = new Set(platformPostIds);
                filteredPosts = posts.filter((p) => idSet.has(p.id as string));
            }

            // Step 8: Enrich each post with platforms + thumbnailUrl (N+1 — bounded by pageSize)
            // A batched approach would require raw Drizzle queries outside the base model API.
            const items: SocialPostListItem[] = await Promise.all(
                filteredPosts.map(async (post) => {
                    const postId = post.id as string;

                    // Resolve platforms for this post
                    const { items: targets } = await this.postTargetModel.findAll(
                        { socialPostId: postId },
                        { page: 1, pageSize: 50 }
                    );
                    const platforms = [
                        ...new Set(
                            targets
                                .map((t) => t.platform as string | undefined)
                                .filter((p): p is string => typeof p === 'string')
                        )
                    ];

                    // Resolve thumbnail: first media asset's cloudinary URL
                    const { items: mediaRows } = await this.postMediaModel.findAll(
                        { socialPostId: postId },
                        { page: 1, pageSize: 1, sortBy: 'position', sortOrder: 'asc' }
                    );
                    let thumbnailUrl: string | null = null;
                    const firstMedia = mediaRows[0];
                    if (firstMedia) {
                        const assetId = firstMedia.assetId as string | undefined;
                        if (assetId) {
                            const asset = await this.assetModel.findOne({
                                id: assetId,
                                deletedAt: null
                            });
                            thumbnailUrl =
                                (asset?.cloudinaryUrl as string | null | undefined) ?? null;
                        }
                    }

                    return {
                        id: postId,
                        title: post.title as string,
                        slug: post.slug as string,
                        status: post.status as string,
                        approvalStatus: post.approvalStatus as string,
                        paused: post.paused as boolean,
                        platforms,
                        thumbnailUrl,
                        scheduledAt: (post.scheduledAt as Date | null | undefined) ?? null,
                        createdAt: post.createdAt as Date
                    };
                })
            );

            serviceLogger.info(
                { actorId: actor.id, total, page, pageSize },
                'SocialPostService.listPosts: completed'
            );

            return { data: { items, total } };
        } catch (err) {
            if (err instanceof ServiceError) {
                return {
                    error: {
                        code: err.code,
                        message: err.message,
                        details: err.details,
                        reason: err.reason
                    }
                };
            }
            const message = err instanceof Error ? err.message : String(err);
            serviceLogger.error(
                { actorId: actor.id, error: message },
                'SocialPostService.listPosts: unexpected error'
            );
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: `Unexpected error during listPosts: ${message}`
                }
            };
        }
    }

    /**
     * Returns the full detail of a social post, with related targets, media
     * (enriched with Cloudinary URLs), resolved hashtags, and the last 10
     * publish logs (newest first).
     *
     * Permission required: SOCIAL_POST_VIEW.
     *
     * @param input - Actor and postId.
     * @returns ServiceOutput containing the assembled {@link SocialPostDetail}.
     */
    public async getPostDetail(
        input: GetPostDetailInput
    ): Promise<ServiceOutput<SocialPostDetail>> {
        const { actor, postId } = input;

        try {
            // Step 1: Permission
            checkCanViewPost(actor);

            // Step 2: Load post (respect soft-delete)
            const post = await this.postModel.findOne({ id: postId, deletedAt: null });
            if (!post) {
                throw new ServiceError(ServiceErrorCode.NOT_FOUND, `Post not found: ${postId}`);
            }

            // Step 3: Load targets
            const { items: targets } = await this.postTargetModel.findAll(
                { socialPostId: postId },
                { page: 1, pageSize: 50 }
            );

            // Step 4: Load media rows, then enrich with cloudinaryUrl from the asset
            const { items: mediaRows } = await this.postMediaModel.findAll(
                { socialPostId: postId },
                { page: 1, pageSize: 50, sortBy: 'position', sortOrder: 'asc' }
            );
            const media = await Promise.all(
                mediaRows.map(async (m) => {
                    const assetId = m.assetId as string | undefined;
                    let cloudinaryUrl: string | null = null;
                    if (assetId) {
                        const asset = await this.assetModel.findOne({
                            id: assetId,
                            deletedAt: null
                        });
                        cloudinaryUrl = (asset?.cloudinaryUrl as string | null | undefined) ?? null;
                    }
                    return { ...m, cloudinaryUrl };
                })
            );

            // Step 5: Resolve hashtags via join table → catalog
            const { items: postHashtags } = await this.postHashtagModel.findAll(
                { socialPostId: postId },
                { page: 1, pageSize: 200 }
            );
            const hashtags: string[] = (
                await Promise.all(
                    postHashtags.map(async (ph) => {
                        const hashtagId = ph.hashtagId as string | undefined;
                        if (!hashtagId) return null;
                        const row = await this.hashtagModel.findOne({ id: hashtagId });
                        return (row?.hashtag as string | null | undefined) ?? null;
                    })
                )
            ).filter((h): h is string => h !== null);

            // Step 6: Load last 10 publish logs (newest first)
            const { items: publishLogs } = await this.publishLogModel.findAll(
                { socialPostId: postId },
                { page: 1, pageSize: 10, sortBy: 'createdAt', sortOrder: 'desc' }
            );

            serviceLogger.info(
                { postId, actorId: actor.id },
                'SocialPostService.getPostDetail: completed'
            );

            return {
                data: {
                    id: postId,
                    title: post.title as string,
                    slug: post.slug as string,
                    status: post.status as string,
                    approvalStatus: post.approvalStatus as string,
                    paused: post.paused as boolean,
                    scheduledAt: (post.scheduledAt as Date | null | undefined) ?? null,
                    captionBase: post.captionBase as string,
                    finalCaption: (post.finalCaption as string | null | undefined) ?? null,
                    finalHashtagsText:
                        (post.finalHashtagsText as string | null | undefined) ?? null,
                    notes: (post.notes as string | null | undefined) ?? null,
                    internalNotes: (post.internalNotes as string | null | undefined) ?? null,
                    gptHashtagPayloadJson:
                        (post.gptHashtagPayloadJson as string[] | null | undefined) ?? null,
                    createdAt: post.createdAt as Date,
                    updatedAt: post.updatedAt as Date,
                    targets,
                    media,
                    hashtags,
                    publishLogs
                }
            };
        } catch (err) {
            if (err instanceof ServiceError) {
                return {
                    error: {
                        code: err.code,
                        message: err.message,
                        details: err.details,
                        reason: err.reason
                    }
                };
            }
            const message = err instanceof Error ? err.message : String(err);
            serviceLogger.error(
                { postId, error: message },
                'SocialPostService.getPostDetail: unexpected error'
            );
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: `Unexpected error during getPostDetail: ${message}`
                }
            };
        }
    }

    /**
     * Updates whitelisted content fields of a social post.
     *
     * Only these fields are accepted: title, captionBase, finalCaption,
     * finalHashtagsText, notes, internalNotes, footerId, campaignId, batchId,
     * audienceId, batchPosition.
     *
     * Fields that control pipeline state (status, approvalStatus, paused) and
     * all soft-delete / audit FK fields are EXPLICITLY STRIPPED from the input
     * and never passed to the DB update.
     *
     * Permission required: SOCIAL_POST_UPDATE.
     *
     * @param input - Actor, postId, and data patch.
     * @returns ServiceOutput containing the updated post row.
     */
    public async updatePost(
        input: UpdatePostInput
    ): Promise<ServiceOutput<Record<string, unknown>>> {
        const { actor, postId, data } = input;

        try {
            // Step 1: Permission
            checkCanUpdatePost(actor);

            // Step 2: Load post
            const post = await this.postModel.findOne({ id: postId, deletedAt: null });
            if (!post) {
                throw new ServiceError(ServiceErrorCode.NOT_FOUND, `Post not found: ${postId}`);
            }

            // Step 3: Build whitelist-only patch. Explicitly pick allowed keys only.
            // Status, approvalStatus, paused, and audit/soft-delete fields are intentionally
            // excluded — they must not be changed via this method even if passed in `data`.
            const patch: Record<string, unknown> = { updatedById: actor.id };
            if (data.title !== undefined) patch.title = data.title;
            if (data.captionBase !== undefined) patch.captionBase = data.captionBase;
            if (data.finalCaption !== undefined) patch.finalCaption = data.finalCaption;
            if (data.finalHashtagsText !== undefined)
                patch.finalHashtagsText = data.finalHashtagsText;
            if (data.notes !== undefined) patch.notes = data.notes;
            if (data.internalNotes !== undefined) patch.internalNotes = data.internalNotes;
            if (data.footerId !== undefined) patch.footerId = data.footerId;
            if (data.campaignId !== undefined) patch.campaignId = data.campaignId;
            if (data.batchId !== undefined) patch.batchId = data.batchId;
            if (data.audienceId !== undefined) patch.audienceId = data.audienceId;
            if (data.batchPosition !== undefined) patch.batchPosition = data.batchPosition;

            // Step 4: Apply the update
            const updated = await this.postModel.update({ id: postId }, patch);
            if (!updated) {
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    `Failed to update post: ${postId}`
                );
            }

            serviceLogger.info(
                { postId, actorId: actor.id },
                'SocialPostService.updatePost: post updated'
            );

            return { data: updated as Record<string, unknown> };
        } catch (err) {
            if (err instanceof ServiceError) {
                return {
                    error: {
                        code: err.code,
                        message: err.message,
                        details: err.details,
                        reason: err.reason
                    }
                };
            }
            const message = err instanceof Error ? err.message : String(err);
            serviceLogger.error(
                { postId, error: message },
                'SocialPostService.updatePost: unexpected error'
            );
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: `Unexpected error during updatePost: ${message}`
                }
            };
        }
    }

    /**
     * Returns aggregate dashboard data for the social publishing pipeline.
     *
     * Includes:
     * - KPI counters (totalPosts, pendingReview, scheduled, publishedLast30Days, failedActionNeeded).
     * - Quick-approval queue (up to 10 NEEDS_REVIEW / PENDING posts, oldest first).
     * - Recent failures (up to 10 FAILED social_post_targets, newest first).
     * - makeWebhookConfigured flag (live check on social_settings.make_webhook_url).
     *
     * publishedLast30Days is derived from social_publish_logs rows with SUCCESS status
     * created in the last 30 days, de-duped by socialPostId. This is more faithful than
     * counting social_posts with status=PUBLISHED because a post may have been published
     * more than 30 days ago and then reprocessed, or the status may lag behind the log.
     *
     * recentFailures is sourced from social_post_targets with status=FAILED (not
     * social_publish_logs), because that is the canonical place where "action needed"
     * state is held. A target in FAILED status means it has been exhausted — the admin
     * needs to take action. The publish log is ephemeral per-attempt; the target row
     * is the durable state.
     *
     * Permission required: SOCIAL_POST_VIEW.
     *
     * @param input - Actor.
     * @returns ServiceOutput containing SocialDashboardData.
     */
    public async getDashboard(
        input: GetDashboardInput
    ): Promise<ServiceOutput<SocialDashboardData>> {
        const { actor } = input;

        try {
            // Permission check
            checkCanViewPost(actor);

            // --- KPIs ---

            // totalPosts: all non-deleted posts
            const { total: totalPosts } = await this.postModel.findAll({ deletedAt: null });

            // pendingReview: NEEDS_REVIEW status with PENDING approvalStatus
            const { total: pendingReview } = await this.postModel.findAll({
                deletedAt: null,
                status: SocialPostStatusEnum.NEEDS_REVIEW,
                approvalStatus: SocialApprovalStatusEnum.PENDING
            });

            // scheduled: posts in SCHEDULED status
            const { total: scheduled } = await this.postModel.findAll({
                deletedAt: null,
                status: SocialPostStatusEnum.SCHEDULED
            });

            // publishedLast30Days: count distinct socialPostIds from SUCCESS publish logs in last 30d
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const { items: recentSuccessLogs } = await this.publishLogModel.findAll(
                { status: SocialPublishResultStatusEnum.SUCCESS },
                { page: 1, pageSize: 2000 },
                [gte(socialPublishLogs.createdAt, thirtyDaysAgo)]
            );
            // De-dup by socialPostId
            const publishedPostIds = new Set(
                recentSuccessLogs
                    .map((log) => log.socialPostId as string | undefined)
                    .filter((id): id is string => typeof id === 'string')
            );
            const publishedLast30Days = publishedPostIds.size;

            // failedActionNeeded: posts in FAILED status
            const { total: failedActionNeeded } = await this.postModel.findAll({
                deletedAt: null,
                status: SocialPostStatusEnum.FAILED
            });

            // --- Quick approval queue ---
            const { items: reviewPosts } = await this.postModel.findAll(
                {
                    deletedAt: null,
                    status: SocialPostStatusEnum.NEEDS_REVIEW,
                    approvalStatus: SocialApprovalStatusEnum.PENDING
                },
                { page: 1, pageSize: 10, sortBy: 'createdAt', sortOrder: 'asc' }
            );

            const quickApprovalQueue: SocialDashboardQueueItem[] = await Promise.all(
                reviewPosts.map(async (post) => {
                    const postId = post.id as string;
                    const { items: targets } = await this.postTargetModel.findAll(
                        { socialPostId: postId },
                        { page: 1, pageSize: 50 }
                    );
                    const platforms = [
                        ...new Set(
                            targets
                                .map((t) => t.platform as string | undefined)
                                .filter((p): p is string => typeof p === 'string')
                        )
                    ];
                    const { items: mediaRows } = await this.postMediaModel.findAll(
                        { socialPostId: postId },
                        { page: 1, pageSize: 1, sortBy: 'position', sortOrder: 'asc' }
                    );
                    let thumbnailUrl: string | null = null;
                    const firstMedia = mediaRows[0];
                    if (firstMedia) {
                        const assetId = firstMedia.assetId as string | undefined;
                        if (assetId) {
                            const asset = await this.assetModel.findOne({
                                id: assetId,
                                deletedAt: null
                            });
                            thumbnailUrl =
                                (asset?.cloudinaryUrl as string | null | undefined) ?? null;
                        }
                    }
                    return {
                        id: postId,
                        title: post.title as string,
                        status: post.status as string,
                        platforms,
                        thumbnailUrl,
                        createdAt: post.createdAt as Date
                    };
                })
            );

            // --- Recent failures from social_post_targets ---
            const { items: failedTargets } = await this.postTargetModel.findAll(
                { status: SocialPostStatusEnum.FAILED },
                { page: 1, pageSize: 10, sortBy: 'updatedAt', sortOrder: 'desc' }
            );

            const recentFailures: SocialDashboardFailureItem[] = await Promise.all(
                failedTargets.map(async (target) => {
                    const socialPostId = target.socialPostId as string;
                    const post = await this.postModel.findOne({ id: socialPostId });
                    return {
                        targetId: target.id as string,
                        postTitle: (post?.title as string | undefined) ?? 'Unknown',
                        platform: target.platform as string,
                        lastError: (target.lastErrorMessage as string | null | undefined) ?? null,
                        retryCount: (target.retryCount as number | undefined) ?? 0,
                        failedAt: target.updatedAt as Date
                    };
                })
            );

            // --- Make webhook configured ---
            const webhookSetting = await this.settingModel.findOne({ key: 'make_webhook_url' });
            const makeWebhookConfigured =
                typeof webhookSetting?.value === 'string' && webhookSetting.value.trim().length > 0;

            serviceLogger.info({ actorId: actor.id }, 'SocialPostService.getDashboard: completed');

            return {
                data: {
                    kpis: {
                        totalPosts,
                        pendingReview,
                        scheduled,
                        publishedLast30Days,
                        failedActionNeeded
                    },
                    quickApprovalQueue,
                    recentFailures,
                    makeWebhookConfigured
                }
            };
        } catch (err) {
            if (err instanceof ServiceError) {
                return {
                    error: {
                        code: err.code,
                        message: err.message,
                        details: err.details,
                        reason: err.reason
                    }
                };
            }
            const message = err instanceof Error ? err.message : String(err);
            serviceLogger.error(
                { actorId: actor.id, error: message },
                'SocialPostService.getDashboard: unexpected error'
            );
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: `Unexpected error during getDashboard: ${message}`
                }
            };
        }
    }

    /**
     * Promotes a hashtag to the social_hashtags catalog and links it to the
     * given post via social_post_hashtags.
     *
     * Workflow (US-3):
     * 1. Permission check — SOCIAL_HASHTAG_MANAGE required.
     * 2. Load post (not found or deleted → NOT_FOUND).
     * 3. Auto-prepend `#` if missing (adds a warning to the result).
     * 4. Normalize (lowercase + `#` prefix via normalizeHashtag).
     * 5. Look up existing hashtag by normalizedHashtag:
     *    - EXISTS → use it (isNew=false). Create link only if not already present.
     *    - NOT EXISTS → create a new social_hashtags row (isNew=true), then create link.
     * 6. Emit HASHTAG_PROMOTED audit log (metadata includes hashtagId, normalizedHashtag, isNew).
     * 7. Return { hashtagId, hashtag: normalizedHashtag, isNew, warnings }.
     *
     * The route uses isNew to choose HTTP 201 (new) vs 200 (existing).
     *
     * Permission required: SOCIAL_HASHTAG_MANAGE.
     *
     * @param input - Actor, postId, hashtag string, and optional catalog attributes.
     * @returns ServiceOutput with PromoteHashtagData.
     */
    public async promoteHashtag(
        input: PromoteHashtagInput
    ): Promise<ServiceOutput<PromoteHashtagData>> {
        const { actor, postId, category, platform, audienceId, priority = 0 } = input;
        let { hashtag } = input;

        try {
            // Step 1: Permission
            checkCanManageHashtag(actor);

            // Step 2: Load post
            const post = await this.postModel.findOne({ id: postId, deletedAt: null });
            if (!post) {
                throw new ServiceError(ServiceErrorCode.NOT_FOUND, `Post not found: ${postId}`);
            }

            // Step 3: Auto-prepend `#` if missing; record warning
            const warnings: ServiceWarning[] = [];
            if (!hashtag.startsWith('#')) {
                hashtag = `#${hashtag}`;
                warnings.push({
                    field: 'hashtag',
                    message: '# prefix auto-added'
                });
            }

            // Step 4: Normalize (lowercase + `#` prefix)
            const normalizedHashtag = normalizeHashtag(hashtag);

            // Step 5: Lookup or create the hashtag catalog entry
            let hashtagId: string;
            let isNew: boolean;

            const existingHashtag = await this.hashtagModel.findOne({ normalizedHashtag });

            if (existingHashtag) {
                hashtagId = existingHashtag.id as string;
                isNew = false;

                // Create link only if it does not already exist
                const existingLink = await this.postHashtagModel.findOne({
                    socialPostId: postId,
                    hashtagId
                });
                if (!existingLink) {
                    await this.postHashtagModel.create({
                        socialPostId: postId,
                        hashtagId,
                        position: 0
                    });
                }
            } else {
                // Create new hashtag catalog entry
                const newHashtag = await this.hashtagModel.create({
                    hashtag,
                    normalizedHashtag,
                    category,
                    platform: platform ?? null,
                    audienceId: audienceId ?? null,
                    priority,
                    active: true,
                    createdById: actor.id
                });
                hashtagId = newHashtag.id as string;
                isNew = true;

                // Create link
                await this.postHashtagModel.create({
                    socialPostId: postId,
                    hashtagId,
                    position: 0
                });
            }

            // Step 6: Audit log
            await this.auditLog.log({
                actorId: actor.id,
                eventType: SocialAuditEvent.HASHTAG_PROMOTED,
                entityType: 'social_post',
                entityId: postId,
                metadata: { hashtagId, normalizedHashtag, isNew }
            });

            serviceLogger.info(
                { postId, hashtagId, normalizedHashtag, isNew, actorId: actor.id },
                'SocialPostService.promoteHashtag: hashtag promoted'
            );

            return {
                data: {
                    hashtagId,
                    hashtag: normalizedHashtag,
                    isNew,
                    warnings
                }
            };
        } catch (err) {
            if (err instanceof ServiceError) {
                return {
                    error: {
                        code: err.code,
                        message: err.message,
                        details: err.details,
                        reason: err.reason
                    }
                };
            }
            const message = err instanceof Error ? err.message : String(err);
            serviceLogger.error(
                { postId, error: message },
                'SocialPostService.promoteHashtag: unexpected error'
            );
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: `Unexpected error during promoteHashtag: ${message}`
                }
            };
        }
    }

    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------

    /**
     * Returns true if ANY of the provided platform-format IDs has `requiresMedia = true`.
     * Loads each format individually — the format table is small and this avoids
     * building a raw `IN (...)` query outside the base model API.
     *
     * @param platformFormatIds - Unique platform-format UUIDs from the post's targets.
     * @returns Whether at least one format requires media.
     */
    private async anyFormatRequiresMedia(platformFormatIds: string[]): Promise<boolean> {
        for (const formatId of platformFormatIds) {
            const format = await this.platformFormatModel.findOne({
                id: formatId,
                deletedAt: null
            });
            if (format?.requiresMedia === true) {
                return true;
            }
        }
        return false;
    }
}

// ---------------------------------------------------------------------------
// Module-level helpers
// ---------------------------------------------------------------------------

/**
 * Builds the new `notes` value by appending `addition` to `existing`.
 *
 * - If `existing` is null/empty, returns `addition` alone.
 * - Otherwise joins with a newline so existing notes are preserved.
 *
 * @param existing - Current notes value (may be null or empty string).
 * @param addition - Text to append (assumed trimmed by the caller).
 * @returns Combined notes string.
 */
function buildAppendedNotes(existing: string | null, addition: string): string {
    const parts = [existing, addition].filter(
        (p): p is string => typeof p === 'string' && p.length > 0
    );
    return parts.join('\n');
}
