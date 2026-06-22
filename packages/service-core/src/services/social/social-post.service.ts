/**
 * @file social-post.service.ts
 *
 * Non-CRUD editorial state-machine service for social posts.
 *
 * Handles the approval workflow for posts in the social publishing pipeline:
 *  - `approve`        — transitions NEEDS_REVIEW → APPROVED (with media check).
 *  - `reject`         — marks a NEEDS_REVIEW post as REJECTED, appends reason to notes.
 *  - `requestChanges` — marks a NEEDS_REVIEW post as CHANGES_REQUESTED, appends feedback.
 *
 * All three methods require the SOCIAL_POST_APPROVE permission.
 * Each transition emits an audit log entry via SocialAuditLogService.
 *
 * This service does NOT extend BaseCrudService.
 *
 * @see SPEC-254 T-033
 */

import type {
    SocialPlatformFormatModel as SocialPlatformFormatModelType,
    SocialPostMediaModel as SocialPostMediaModelType,
    SocialPostModel as SocialPostModelType,
    SocialPostTargetModel as SocialPostTargetModelType
} from '@repo/db';
import {
    SocialPlatformFormatModel,
    SocialPostMediaModel,
    SocialPostModel,
    SocialPostTargetModel
} from '@repo/db';
import { SocialApprovalStatusEnum, SocialPostStatusEnum } from '@repo/schemas';
import { ServiceErrorCode } from '@repo/schemas';
import type { ServiceConfig, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { serviceLogger } from '../../utils/service-logger';
import { SocialAuditEvent, SocialAuditLogService } from './social-audit-log.service';
import type { SocialAuditLogService as SocialAuditLogServiceType } from './social-audit-log.service';
import {
    checkCanApprovePost,
    checkCanArchivePost,
    checkCanPausePost,
    checkCanSchedulePost
} from './social.permissions';

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

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
    readonly actor: import('../../types').Actor;
    /** UUID of the post to archive. */
    readonly postId: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Editorial state-machine service for social posts.
 *
 * ## Responsibilities
 * - Enforces permission checks (SOCIAL_POST_APPROVE gates all three methods).
 * - Guards state transitions (posts must be in the correct state to advance).
 * - Runs a media-presence check before approval when any target requires media.
 * - Updates the post row on every transition.
 * - Emits an audit log row on every successful transition.
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
 * SPEC-254 T-033 / T-034.
 */
export class SocialPostService {
    private readonly postModel: SocialPostModelType;
    private readonly postTargetModel: SocialPostTargetModelType;
    private readonly postMediaModel: SocialPostMediaModelType;
    private readonly platformFormatModel: SocialPlatformFormatModelType;
    private readonly auditLog: SocialAuditLogServiceType;

    constructor(
        config: ServiceConfig,
        postModel?: SocialPostModelType,
        postTargetModel?: SocialPostTargetModelType,
        postMediaModel?: SocialPostMediaModelType,
        platformFormatModel?: SocialPlatformFormatModelType,
        auditLog?: SocialAuditLogServiceType
    ) {
        this.postModel = postModel ?? new SocialPostModel();
        this.postTargetModel = postTargetModel ?? new SocialPostTargetModel();
        this.postMediaModel = postMediaModel ?? new SocialPostMediaModel();
        this.platformFormatModel = platformFormatModel ?? new SocialPlatformFormatModel();
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
