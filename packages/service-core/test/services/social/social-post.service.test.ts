/**
 * Unit tests for SocialPostService — the editorial state-machine service.
 *
 * All DB interactions are mocked — no real Postgres calls.
 * SocialAuditLogService is also mocked.
 *
 * Covers:
 *
 * approve:
 *   - Happy path: correct field updates + audit called + returns id/status/approvalStatus
 *   - FORBIDDEN when actor lacks SOCIAL_POST_APPROVE
 *   - NOT_FOUND when post does not exist
 *   - INVALID_STATE when post.status !== NEEDS_REVIEW
 *   - MISSING_MEDIA when no media rows and a target requires media
 *   - SUCCESS when no media AND no target requires media (requiresMedia=false)
 *
 * reject:
 *   - Happy path: approvalStatus=REJECTED, status stays NEEDS_REVIEW, notes appended (preserving existing), audit called
 *   - VALIDATION_ERROR on blank reason
 *   - NOT_FOUND when post does not exist
 *   - FORBIDDEN when actor lacks permission
 *   - Notes correctly appended when existing notes is non-null
 *
 * requestChanges:
 *   - Happy path: approvalStatus=CHANGES_REQUESTED, notes appended, audit called
 *   - VALIDATION_ERROR on blank feedback
 *   - FORBIDDEN when actor lacks permission
 *   - Notes correctly appended when existing notes is non-null
 *
 * schedule (T-034):
 *   - Happy path APPROVED→SCHEDULED: correct fields + nextRunAt=scheduledAt + audit POST_SCHEDULED
 *   - Reschedule SCHEDULED→SCHEDULED: audit POST_RESCHEDULED with old/new scheduledAt
 *   - VALIDATION_ERROR when scheduledAt is in the past
 *   - INVALID_STATE when status not APPROVED/SCHEDULED
 *   - FORBIDDEN
 *   - NOT_FOUND
 *
 * markReady (T-034):
 *   - Happy path APPROVED→READY_TO_PUBLISH: nextRunAt≈now + audit POST_MARKED_READY
 *   - INVALID_STATE when not APPROVED
 *   - FORBIDDEN
 *
 * pause (T-034):
 *   - Happy path: paused=true + audit POST_PAUSED
 *   - INVALID_STATE when PUBLISHED
 *   - INVALID_STATE when FAILED
 *   - FORBIDDEN
 *
 * unpause (T-034):
 *   - Happy path: paused=false + audit POST_UNPAUSED
 *   - FORBIDDEN
 *
 * archive (T-034):
 *   - Happy path: status=ARCHIVED + deletedAt set + deletedById + audit POST_ARCHIVED
 *   - INVALID_STATE when PUBLISHING
 *   - FORBIDDEN
 *   - NOT_FOUND
 *
 * SPEC-254 T-033 / T-034.
 */

import {
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    SocialApprovalStatusEnum,
    SocialPostStatusEnum
} from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import type { SocialAuditLogService } from '../../../src/services/social/social-audit-log.service';
import { SocialAuditEvent } from '../../../src/services/social/social-audit-log.service';
import type {
    ApprovePostInput,
    ArchivePostInput,
    MarkReadyPostInput,
    PausePostInput,
    RejectPostInput,
    RequestChangesInput,
    SchedulePostInput,
    UnpausePostInput
} from '../../../src/services/social/social-post.service';
import { SocialPostService } from '../../../src/services/social/social-post.service';
import type { Actor } from '../../../src/types';
import { createModelMock } from '../../utils/modelMockFactory';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POST_ID = '00000000-0000-4000-8000-000000000001';
const ACTOR_ID = '00000000-0000-4000-8000-000000000002';
const TARGET_ID = '00000000-0000-4000-8000-000000000003';
const FORMAT_ID = '00000000-0000-4000-8000-000000000004';
const MEDIA_ID = '00000000-0000-4000-8000-000000000005';

// ---------------------------------------------------------------------------
// Actor fixtures
// ---------------------------------------------------------------------------

function buildActor(hasApprove: boolean): Actor {
    return {
        id: ACTOR_ID,
        role: RoleEnum.ADMIN,
        permissions: hasApprove ? [PermissionEnum.SOCIAL_POST_APPROVE] : []
    };
}

function buildActorWithSchedule(hasPerm: boolean): Actor {
    return {
        id: ACTOR_ID,
        role: RoleEnum.ADMIN,
        permissions: hasPerm ? [PermissionEnum.SOCIAL_POST_SCHEDULE] : []
    };
}

function buildActorWithPause(hasPerm: boolean): Actor {
    return {
        id: ACTOR_ID,
        role: RoleEnum.ADMIN,
        permissions: hasPerm ? [PermissionEnum.SOCIAL_POST_PAUSE] : []
    };
}

function buildActorWithArchive(hasPerm: boolean): Actor {
    return {
        id: ACTOR_ID,
        role: RoleEnum.ADMIN,
        permissions: hasPerm ? [PermissionEnum.SOCIAL_POST_ARCHIVE] : []
    };
}

const actorWithPerm = buildActor(true);
const actorWithoutPerm = buildActor(false);
const actorWithSchedulePerm = buildActorWithSchedule(true);
const actorWithoutSchedulePerm = buildActorWithSchedule(false);
const actorWithPausePerm = buildActorWithPause(true);
const actorWithoutPausePerm = buildActorWithPause(false);
const actorWithArchivePerm = buildActorWithArchive(true);
const actorWithoutArchivePerm = buildActorWithArchive(false);

// ---------------------------------------------------------------------------
// Post / row fixtures
// ---------------------------------------------------------------------------

function buildPostRow(overrides: Record<string, unknown> = {}) {
    return {
        id: POST_ID,
        draftId: 'draft-abc',
        title: 'Test Post',
        slug: 'test-post',
        status: SocialPostStatusEnum.NEEDS_REVIEW,
        approvalStatus: SocialApprovalStatusEnum.PENDING,
        notes: null,
        paused: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        ...overrides
    };
}

function buildTargetRow(overrides: Record<string, unknown> = {}) {
    return {
        id: TARGET_ID,
        socialPostId: POST_ID,
        platformFormatId: FORMAT_ID,
        platform: 'INSTAGRAM',
        publishFormat: 'FEED_POST',
        mediaType: 'IMAGE',
        ...overrides
    };
}

function buildFormatRow(requiresMedia: boolean, overrides: Record<string, unknown> = {}) {
    return {
        id: FORMAT_ID,
        platform: 'INSTAGRAM',
        publishFormat: 'FEED_POST',
        mediaType: 'IMAGE',
        enabled: true,
        requiresMedia,
        deletedAt: null,
        ...overrides
    };
}

function buildMediaRow() {
    return {
        id: MEDIA_ID,
        socialPostId: POST_ID,
        assetId: 'asset-uuid',
        position: 0
    };
}

// ---------------------------------------------------------------------------
// Audit log mock
// ---------------------------------------------------------------------------

function buildAuditLogMock(): SocialAuditLogService {
    return {
        log: vi.fn().mockResolvedValue({ logged: true })
    } as unknown as SocialAuditLogService;
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

interface BuildServiceOptions {
    postModel?: ReturnType<typeof createModelMock>;
    postTargetModel?: ReturnType<typeof createModelMock>;
    postMediaModel?: ReturnType<typeof createModelMock>;
    platformFormatModel?: ReturnType<typeof createModelMock>;
    auditLog?: SocialAuditLogService;
}

function buildService(opts: BuildServiceOptions = {}) {
    const postModel =
        opts.postModel ??
        (() => {
            const m = createModelMock();
            m.findOne.mockResolvedValue(buildPostRow());
            m.update.mockResolvedValue(buildPostRow());
            return m;
        })();

    const postTargetModel =
        opts.postTargetModel ??
        (() => {
            const m = createModelMock();
            m.findAll.mockResolvedValue({ items: [], total: 0 });
            return m;
        })();

    const postMediaModel =
        opts.postMediaModel ??
        (() => {
            const m = createModelMock();
            m.findAll.mockResolvedValue({ items: [], total: 0 });
            return m;
        })();

    const platformFormatModel =
        opts.platformFormatModel ??
        (() => {
            const m = createModelMock();
            m.findOne.mockResolvedValue(buildFormatRow(false));
            return m;
        })();

    const auditLog = opts.auditLog ?? buildAuditLogMock();

    const service = new SocialPostService(
        {},
        postModel as never,
        postTargetModel as never,
        postMediaModel as never,
        platformFormatModel as never,
        auditLog
    );

    return {
        service,
        postModel,
        postTargetModel,
        postMediaModel,
        platformFormatModel,
        auditLog
    };
}

// ---------------------------------------------------------------------------
// Tests — approve
// ---------------------------------------------------------------------------

describe('SocialPostService.approve', () => {
    describe('happy path', () => {
        it('should return id/status/approvalStatus and call audit log on success', async () => {
            // Arrange
            const auditLog = buildAuditLogMock();
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(buildPostRow());
            postModel.update.mockResolvedValue(
                buildPostRow({
                    status: SocialPostStatusEnum.APPROVED,
                    approvalStatus: SocialApprovalStatusEnum.APPROVED
                })
            );
            const { service } = buildService({ postModel, auditLog });
            const input: ApprovePostInput = { actor: actorWithPerm, postId: POST_ID };

            // Act
            const result = await service.approve(input);

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data).toMatchObject({
                id: POST_ID,
                status: SocialPostStatusEnum.APPROVED,
                approvalStatus: SocialApprovalStatusEnum.APPROVED
            });
            expect(auditLog.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    actorId: ACTOR_ID,
                    eventType: SocialAuditEvent.POST_APPROVED,
                    entityType: 'social_post',
                    entityId: POST_ID
                })
            );
        });

        it('should call postModel.update with correct approval fields', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(buildPostRow());
            postModel.update.mockResolvedValue(buildPostRow());
            const { service } = buildService({ postModel });
            const input: ApprovePostInput = { actor: actorWithPerm, postId: POST_ID };

            // Act
            await service.approve(input);

            // Assert
            expect(postModel.update).toHaveBeenCalledWith(
                { id: POST_ID },
                expect.objectContaining({
                    status: SocialPostStatusEnum.APPROVED,
                    approvalStatus: SocialApprovalStatusEnum.APPROVED,
                    approvedById: ACTOR_ID,
                    updatedById: ACTOR_ID
                })
            );
        });
    });

    describe('FORBIDDEN', () => {
        it('should return FORBIDDEN error when actor lacks SOCIAL_POST_APPROVE', async () => {
            // Arrange
            const { service } = buildService();
            const input: ApprovePostInput = { actor: actorWithoutPerm, postId: POST_ID };

            // Act
            const result = await service.approve(input);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('NOT_FOUND', () => {
        it('should return NOT_FOUND when post does not exist', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(null);
            const { service } = buildService({ postModel });
            const input: ApprovePostInput = { actor: actorWithPerm, postId: POST_ID };

            // Act
            const result = await service.approve(input);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });
    });

    describe('INVALID_STATE', () => {
        it('should return VALIDATION_ERROR with reason INVALID_STATE when post status is not NEEDS_REVIEW', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(
                buildPostRow({ status: SocialPostStatusEnum.APPROVED })
            );
            const { service } = buildService({ postModel });
            const input: ApprovePostInput = { actor: actorWithPerm, postId: POST_ID };

            // Act
            const result = await service.approve(input);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.reason).toBe('INVALID_STATE');
            expect(result.error?.message).toContain('NEEDS_REVIEW');
        });
    });

    describe('MISSING_MEDIA', () => {
        it('should return VALIDATION_ERROR with reason MISSING_MEDIA when no media and a target requires media', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(buildPostRow());
            postModel.update.mockResolvedValue(buildPostRow());

            const postTargetModel = createModelMock();
            postTargetModel.findAll.mockResolvedValue({ items: [buildTargetRow()], total: 1 });

            const platformFormatModel = createModelMock();
            // This format requires media
            platformFormatModel.findOne.mockResolvedValue(buildFormatRow(true));

            const postMediaModel = createModelMock();
            // No media rows
            postMediaModel.findAll.mockResolvedValue({ items: [], total: 0 });

            const { service } = buildService({
                postModel,
                postTargetModel,
                platformFormatModel,
                postMediaModel
            });
            const input: ApprovePostInput = { actor: actorWithPerm, postId: POST_ID };

            // Act
            const result = await service.approve(input);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.reason).toBe('MISSING_MEDIA');
            expect(result.error?.message).toContain('no media');
        });

        it('should succeed when no media but no target requires media (requiresMedia=false)', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(buildPostRow());
            postModel.update.mockResolvedValue(buildPostRow());

            const postTargetModel = createModelMock();
            postTargetModel.findAll.mockResolvedValue({ items: [buildTargetRow()], total: 1 });

            const platformFormatModel = createModelMock();
            // This format does NOT require media
            platformFormatModel.findOne.mockResolvedValue(buildFormatRow(false));

            const postMediaModel = createModelMock();
            // No media rows — still fine because format doesn't require media
            postMediaModel.findAll.mockResolvedValue({ items: [], total: 0 });

            const { service } = buildService({
                postModel,
                postTargetModel,
                platformFormatModel,
                postMediaModel
            });
            const input: ApprovePostInput = { actor: actorWithPerm, postId: POST_ID };

            // Act
            const result = await service.approve(input);

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.status).toBe(SocialPostStatusEnum.APPROVED);
        });

        it('should succeed when media exists and a target requires media', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(buildPostRow());
            postModel.update.mockResolvedValue(buildPostRow());

            const postTargetModel = createModelMock();
            postTargetModel.findAll.mockResolvedValue({ items: [buildTargetRow()], total: 1 });

            const platformFormatModel = createModelMock();
            platformFormatModel.findOne.mockResolvedValue(buildFormatRow(true));

            const postMediaModel = createModelMock();
            // Has media
            postMediaModel.findAll.mockResolvedValue({ items: [buildMediaRow()], total: 1 });

            const { service } = buildService({
                postModel,
                postTargetModel,
                platformFormatModel,
                postMediaModel
            });
            const input: ApprovePostInput = { actor: actorWithPerm, postId: POST_ID };

            // Act
            const result = await service.approve(input);

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.status).toBe(SocialPostStatusEnum.APPROVED);
        });
    });
});

// ---------------------------------------------------------------------------
// Tests — reject
// ---------------------------------------------------------------------------

describe('SocialPostService.reject', () => {
    describe('happy path', () => {
        it('should set approvalStatus=REJECTED, keep status=NEEDS_REVIEW, append notes, and call audit', async () => {
            // Arrange
            const auditLog = buildAuditLogMock();
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(buildPostRow({ notes: 'existing note' }));
            postModel.update.mockResolvedValue(buildPostRow());
            const { service } = buildService({ postModel, auditLog });
            const input: RejectPostInput = {
                actor: actorWithPerm,
                postId: POST_ID,
                reason: 'Off-brand content'
            };

            // Act
            const result = await service.reject(input);

            // Assert — return value
            expect(result.error).toBeUndefined();
            expect(result.data).toMatchObject({
                id: POST_ID,
                status: SocialPostStatusEnum.NEEDS_REVIEW,
                approvalStatus: SocialApprovalStatusEnum.REJECTED
            });

            // Assert — correct fields sent to model
            expect(postModel.update).toHaveBeenCalledWith(
                { id: POST_ID },
                expect.objectContaining({
                    approvalStatus: SocialApprovalStatusEnum.REJECTED,
                    updatedById: ACTOR_ID
                })
            );

            // Assert — audit log called
            expect(auditLog.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    actorId: ACTOR_ID,
                    eventType: SocialAuditEvent.POST_REJECTED,
                    entityType: 'social_post',
                    entityId: POST_ID
                })
            );
        });

        it('should append reason to existing notes (notes preserved)', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(buildPostRow({ notes: 'First note' }));
            postModel.update.mockResolvedValue(buildPostRow());
            const { service } = buildService({ postModel });
            const input: RejectPostInput = {
                actor: actorWithPerm,
                postId: POST_ID,
                reason: 'Second reason'
            };

            // Act
            await service.reject(input);

            // Assert — notes joined with newline, existing note preserved
            const updateCall = (postModel.update as ReturnType<typeof vi.fn>).mock.calls[0];
            const updateData = updateCall?.[1] as Record<string, unknown>;
            expect(updateData?.notes).toBe('First note\nSecond reason');
        });

        it('should set notes to reason when existing notes is null', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(buildPostRow({ notes: null }));
            postModel.update.mockResolvedValue(buildPostRow());
            const { service } = buildService({ postModel });
            const input: RejectPostInput = {
                actor: actorWithPerm,
                postId: POST_ID,
                reason: 'Only reason'
            };

            // Act
            await service.reject(input);

            // Assert
            const updateCall = (postModel.update as ReturnType<typeof vi.fn>).mock.calls[0];
            const updateData = updateCall?.[1] as Record<string, unknown>;
            expect(updateData?.notes).toBe('Only reason');
        });
    });

    describe('VALIDATION_ERROR — blank reason', () => {
        it('should return VALIDATION_ERROR when reason is empty string', async () => {
            // Arrange
            const { service } = buildService();
            const input: RejectPostInput = {
                actor: actorWithPerm,
                postId: POST_ID,
                reason: '   '
            };

            // Act
            const result = await service.reject(input);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.message).toContain('reason');
        });

        it('should return VALIDATION_ERROR when reason is empty', async () => {
            // Arrange
            const { service } = buildService();
            const input: RejectPostInput = {
                actor: actorWithPerm,
                postId: POST_ID,
                reason: ''
            };

            // Act
            const result = await service.reject(input);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        });
    });

    describe('NOT_FOUND', () => {
        it('should return NOT_FOUND when post does not exist', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(null);
            const { service } = buildService({ postModel });
            const input: RejectPostInput = {
                actor: actorWithPerm,
                postId: POST_ID,
                reason: 'Bad content'
            };

            // Act
            const result = await service.reject(input);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });
    });

    describe('FORBIDDEN', () => {
        it('should return FORBIDDEN when actor lacks SOCIAL_POST_APPROVE', async () => {
            // Arrange
            const { service } = buildService();
            const input: RejectPostInput = {
                actor: actorWithoutPerm,
                postId: POST_ID,
                reason: 'Bad content'
            };

            // Act
            const result = await service.reject(input);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('INVALID_STATE', () => {
        it('should return VALIDATION_ERROR with reason INVALID_STATE when post is not NEEDS_REVIEW/PENDING', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(
                buildPostRow({ approvalStatus: SocialApprovalStatusEnum.APPROVED })
            );
            const { service } = buildService({ postModel });
            const input: RejectPostInput = {
                actor: actorWithPerm,
                postId: POST_ID,
                reason: 'Late rejection'
            };

            // Act
            const result = await service.reject(input);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.reason).toBe('INVALID_STATE');
        });
    });
});

// ---------------------------------------------------------------------------
// Tests — requestChanges
// ---------------------------------------------------------------------------

describe('SocialPostService.requestChanges', () => {
    describe('happy path', () => {
        it('should set approvalStatus=CHANGES_REQUESTED, append notes, and call audit', async () => {
            // Arrange
            const auditLog = buildAuditLogMock();
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(buildPostRow({ notes: 'prior note' }));
            postModel.update.mockResolvedValue(buildPostRow());
            const { service } = buildService({ postModel, auditLog });
            const input: RequestChangesInput = {
                actor: actorWithPerm,
                postId: POST_ID,
                feedback: 'Caption too long'
            };

            // Act
            const result = await service.requestChanges(input);

            // Assert — return value
            expect(result.error).toBeUndefined();
            expect(result.data).toMatchObject({
                id: POST_ID,
                approvalStatus: SocialApprovalStatusEnum.CHANGES_REQUESTED
            });

            // Assert — correct approvalStatus sent to model
            expect(postModel.update).toHaveBeenCalledWith(
                { id: POST_ID },
                expect.objectContaining({
                    approvalStatus: SocialApprovalStatusEnum.CHANGES_REQUESTED,
                    updatedById: ACTOR_ID
                })
            );

            // Assert — audit log called
            expect(auditLog.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    actorId: ACTOR_ID,
                    eventType: SocialAuditEvent.POST_CHANGES_REQUESTED,
                    entityType: 'social_post',
                    entityId: POST_ID
                })
            );
        });

        it('should append feedback to existing notes (notes preserved)', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(buildPostRow({ notes: 'original note' }));
            postModel.update.mockResolvedValue(buildPostRow());
            const { service } = buildService({ postModel });
            const input: RequestChangesInput = {
                actor: actorWithPerm,
                postId: POST_ID,
                feedback: 'Shorten caption'
            };

            // Act
            await service.requestChanges(input);

            // Assert — notes joined with newline, existing note preserved
            const updateCall = (postModel.update as ReturnType<typeof vi.fn>).mock.calls[0];
            const updateData = updateCall?.[1] as Record<string, unknown>;
            expect(updateData?.notes).toBe('original note\nShorten caption');
        });

        it('should set notes to feedback when existing notes is null', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(buildPostRow({ notes: null }));
            postModel.update.mockResolvedValue(buildPostRow());
            const { service } = buildService({ postModel });
            const input: RequestChangesInput = {
                actor: actorWithPerm,
                postId: POST_ID,
                feedback: 'Fix the image'
            };

            // Act
            await service.requestChanges(input);

            // Assert
            const updateCall = (postModel.update as ReturnType<typeof vi.fn>).mock.calls[0];
            const updateData = updateCall?.[1] as Record<string, unknown>;
            expect(updateData?.notes).toBe('Fix the image');
        });
    });

    describe('VALIDATION_ERROR — blank feedback', () => {
        it('should return VALIDATION_ERROR when feedback is whitespace-only', async () => {
            // Arrange
            const { service } = buildService();
            const input: RequestChangesInput = {
                actor: actorWithPerm,
                postId: POST_ID,
                feedback: '   '
            };

            // Act
            const result = await service.requestChanges(input);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.message).toContain('feedback');
        });

        it('should return VALIDATION_ERROR when feedback is empty string', async () => {
            // Arrange
            const { service } = buildService();
            const input: RequestChangesInput = {
                actor: actorWithPerm,
                postId: POST_ID,
                feedback: ''
            };

            // Act
            const result = await service.requestChanges(input);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        });
    });

    describe('FORBIDDEN', () => {
        it('should return FORBIDDEN when actor lacks SOCIAL_POST_APPROVE', async () => {
            // Arrange
            const { service } = buildService();
            const input: RequestChangesInput = {
                actor: actorWithoutPerm,
                postId: POST_ID,
                feedback: 'Fix something'
            };

            // Act
            const result = await service.requestChanges(input);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('NOT_FOUND', () => {
        it('should return NOT_FOUND when post does not exist', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(null);
            const { service } = buildService({ postModel });
            const input: RequestChangesInput = {
                actor: actorWithPerm,
                postId: POST_ID,
                feedback: 'Fix something'
            };

            // Act
            const result = await service.requestChanges(input);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });
    });

    describe('notes append — edge cases', () => {
        it('should not overwrite notes when both exist (append, not replace)', async () => {
            // Arrange
            const postModel = createModelMock();
            const existingNote = 'Do not delete this';
            postModel.findOne.mockResolvedValue(buildPostRow({ notes: existingNote }));
            postModel.update.mockResolvedValue(buildPostRow());
            const { service } = buildService({ postModel });
            const input: RequestChangesInput = {
                actor: actorWithPerm,
                postId: POST_ID,
                feedback: 'New feedback'
            };

            // Act
            await service.requestChanges(input);

            // Assert — old note is preserved
            const updateCall = (postModel.update as ReturnType<typeof vi.fn>).mock.calls[0];
            const updateData = updateCall?.[1] as Record<string, unknown>;
            expect(updateData?.notes).toContain(existingNote);
            expect(updateData?.notes).toContain('New feedback');
        });
    });
});

// ---------------------------------------------------------------------------
// Tests — schedule (T-034)
// ---------------------------------------------------------------------------

describe('SocialPostService.schedule', () => {
    describe('happy path — first schedule (APPROVED → SCHEDULED)', () => {
        it('should set status=SCHEDULED, scheduledAt, timezone, nextRunAt=scheduledAt, and call audit POST_SCHEDULED', async () => {
            // Arrange
            const auditLog = buildAuditLogMock();
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(
                buildPostRow({ status: SocialPostStatusEnum.APPROVED })
            );
            postModel.update.mockResolvedValue(
                buildPostRow({ status: SocialPostStatusEnum.SCHEDULED })
            );
            const { service } = buildService({ postModel, auditLog });
            const futureDate = new Date(Date.now() + 60_000);
            const input: SchedulePostInput = {
                actor: actorWithSchedulePerm,
                postId: POST_ID,
                scheduledAt: futureDate,
                timezone: 'America/Argentina/Buenos_Aires'
            };

            // Act
            const result = await service.schedule(input);

            // Assert — return value
            expect(result.error).toBeUndefined();
            expect(result.data).toMatchObject({
                id: POST_ID,
                status: SocialPostStatusEnum.SCHEDULED,
                scheduledAt: futureDate
            });

            // Assert — correct fields passed to model
            expect(postModel.update).toHaveBeenCalledWith(
                { id: POST_ID },
                expect.objectContaining({
                    status: SocialPostStatusEnum.SCHEDULED,
                    scheduledAt: futureDate,
                    timezone: 'America/Argentina/Buenos_Aires',
                    nextRunAt: futureDate,
                    updatedById: ACTOR_ID
                })
            );

            // Assert — audit called with POST_SCHEDULED
            expect(auditLog.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    actorId: ACTOR_ID,
                    eventType: SocialAuditEvent.POST_SCHEDULED,
                    entityType: 'social_post',
                    entityId: POST_ID,
                    oldValue: expect.objectContaining({ status: SocialPostStatusEnum.APPROVED }),
                    newValue: expect.objectContaining({
                        status: SocialPostStatusEnum.SCHEDULED,
                        scheduledAt: futureDate
                    })
                })
            );
        });
    });

    describe('happy path — reschedule (SCHEDULED → SCHEDULED)', () => {
        it('should replace scheduledAt and audit POST_RESCHEDULED with old/new values', async () => {
            // Arrange
            const auditLog = buildAuditLogMock();
            const oldScheduledAt = new Date(Date.now() + 3_600_000);
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(
                buildPostRow({
                    status: SocialPostStatusEnum.SCHEDULED,
                    scheduledAt: oldScheduledAt
                })
            );
            postModel.update.mockResolvedValue(
                buildPostRow({ status: SocialPostStatusEnum.SCHEDULED })
            );
            const { service } = buildService({ postModel, auditLog });
            const newScheduledAt = new Date(Date.now() + 7_200_000);
            const input: SchedulePostInput = {
                actor: actorWithSchedulePerm,
                postId: POST_ID,
                scheduledAt: newScheduledAt,
                timezone: 'UTC'
            };

            // Act
            const result = await service.schedule(input);

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.status).toBe(SocialPostStatusEnum.SCHEDULED);

            // Assert — audit called with POST_RESCHEDULED
            expect(auditLog.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    eventType: SocialAuditEvent.POST_RESCHEDULED,
                    oldValue: expect.objectContaining({ scheduledAt: oldScheduledAt }),
                    newValue: expect.objectContaining({ scheduledAt: newScheduledAt })
                })
            );
        });
    });

    describe('VALIDATION_ERROR — scheduledAt in the past', () => {
        it('should return VALIDATION_ERROR when scheduledAt is in the past', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(
                buildPostRow({ status: SocialPostStatusEnum.APPROVED })
            );
            const { service } = buildService({ postModel });
            const pastDate = new Date(Date.now() - 60_000);
            const input: SchedulePostInput = {
                actor: actorWithSchedulePerm,
                postId: POST_ID,
                scheduledAt: pastDate,
                timezone: 'UTC'
            };

            // Act
            const result = await service.schedule(input);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.message).toContain('scheduledAt must be in the future');
        });
    });

    describe('INVALID_STATE', () => {
        it('should return VALIDATION_ERROR with reason INVALID_STATE when status is not APPROVED or SCHEDULED', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(
                buildPostRow({ status: SocialPostStatusEnum.PUBLISHED })
            );
            const { service } = buildService({ postModel });
            const futureDate = new Date(Date.now() + 60_000);
            const input: SchedulePostInput = {
                actor: actorWithSchedulePerm,
                postId: POST_ID,
                scheduledAt: futureDate,
                timezone: 'UTC'
            };

            // Act
            const result = await service.schedule(input);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.reason).toBe('INVALID_STATE');
        });
    });

    describe('FORBIDDEN', () => {
        it('should return FORBIDDEN when actor lacks SOCIAL_POST_SCHEDULE', async () => {
            // Arrange
            const { service } = buildService();
            const futureDate = new Date(Date.now() + 60_000);
            const input: SchedulePostInput = {
                actor: actorWithoutSchedulePerm,
                postId: POST_ID,
                scheduledAt: futureDate,
                timezone: 'UTC'
            };

            // Act
            const result = await service.schedule(input);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('NOT_FOUND', () => {
        it('should return NOT_FOUND when post does not exist', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(null);
            const { service } = buildService({ postModel });
            const futureDate = new Date(Date.now() + 60_000);
            const input: SchedulePostInput = {
                actor: actorWithSchedulePerm,
                postId: POST_ID,
                scheduledAt: futureDate,
                timezone: 'UTC'
            };

            // Act
            const result = await service.schedule(input);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });
    });
});

// ---------------------------------------------------------------------------
// Tests — markReady (T-034)
// ---------------------------------------------------------------------------

describe('SocialPostService.markReady', () => {
    describe('happy path', () => {
        it('should set status=READY_TO_PUBLISH, nextRunAt≈now, and call audit POST_MARKED_READY', async () => {
            // Arrange
            const auditLog = buildAuditLogMock();
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(
                buildPostRow({ status: SocialPostStatusEnum.APPROVED })
            );
            postModel.update.mockResolvedValue(
                buildPostRow({ status: SocialPostStatusEnum.READY_TO_PUBLISH })
            );
            const { service } = buildService({ postModel, auditLog });
            const beforeCall = Date.now();
            const input: MarkReadyPostInput = { actor: actorWithSchedulePerm, postId: POST_ID };

            // Act
            const result = await service.markReady(input);
            const afterCall = Date.now();

            // Assert — return value
            expect(result.error).toBeUndefined();
            expect(result.data).toMatchObject({
                id: POST_ID,
                status: SocialPostStatusEnum.READY_TO_PUBLISH
            });

            // Assert — nextRunAt is approximately now
            const updateCall = (postModel.update as ReturnType<typeof vi.fn>).mock.calls[0];
            const updateData = updateCall?.[1] as Record<string, unknown>;
            const nextRunAt = updateData?.nextRunAt as Date;
            expect(nextRunAt).toBeInstanceOf(Date);
            expect(nextRunAt.getTime()).toBeGreaterThanOrEqual(beforeCall);
            expect(nextRunAt.getTime()).toBeLessThanOrEqual(afterCall + 5);

            // Assert — audit called with POST_MARKED_READY
            expect(auditLog.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    actorId: ACTOR_ID,
                    eventType: SocialAuditEvent.POST_MARKED_READY,
                    entityType: 'social_post',
                    entityId: POST_ID
                })
            );
        });
    });

    describe('INVALID_STATE', () => {
        it('should return VALIDATION_ERROR with reason INVALID_STATE when post is not APPROVED', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(
                buildPostRow({ status: SocialPostStatusEnum.SCHEDULED })
            );
            const { service } = buildService({ postModel });
            const input: MarkReadyPostInput = { actor: actorWithSchedulePerm, postId: POST_ID };

            // Act
            const result = await service.markReady(input);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.reason).toBe('INVALID_STATE');
            expect(result.error?.message).toContain('APPROVED');
        });
    });

    describe('FORBIDDEN', () => {
        it('should return FORBIDDEN when actor lacks SOCIAL_POST_SCHEDULE', async () => {
            // Arrange
            const { service } = buildService();
            const input: MarkReadyPostInput = {
                actor: actorWithoutSchedulePerm,
                postId: POST_ID
            };

            // Act
            const result = await service.markReady(input);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });
});

// ---------------------------------------------------------------------------
// Tests — pause (T-034)
// ---------------------------------------------------------------------------

describe('SocialPostService.pause', () => {
    describe('happy path', () => {
        it('should set paused=true and call audit POST_PAUSED', async () => {
            // Arrange
            const auditLog = buildAuditLogMock();
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(
                buildPostRow({ status: SocialPostStatusEnum.APPROVED, paused: false })
            );
            postModel.update.mockResolvedValue(buildPostRow({ paused: true }));
            const { service } = buildService({ postModel, auditLog });
            const input: PausePostInput = { actor: actorWithPausePerm, postId: POST_ID };

            // Act
            const result = await service.pause(input);

            // Assert — return value
            expect(result.error).toBeUndefined();
            expect(result.data).toMatchObject({ id: POST_ID, paused: true });

            // Assert — model updated with paused=true
            expect(postModel.update).toHaveBeenCalledWith(
                { id: POST_ID },
                expect.objectContaining({ paused: true, updatedById: ACTOR_ID })
            );

            // Assert — audit called with POST_PAUSED
            expect(auditLog.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    actorId: ACTOR_ID,
                    eventType: SocialAuditEvent.POST_PAUSED,
                    entityType: 'social_post',
                    entityId: POST_ID
                })
            );
        });
    });

    describe('INVALID_STATE — PUBLISHED', () => {
        it('should return VALIDATION_ERROR with reason INVALID_STATE when post is PUBLISHED', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(
                buildPostRow({ status: SocialPostStatusEnum.PUBLISHED })
            );
            const { service } = buildService({ postModel });
            const input: PausePostInput = { actor: actorWithPausePerm, postId: POST_ID };

            // Act
            const result = await service.pause(input);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.reason).toBe('INVALID_STATE');
            expect(result.error?.message).toContain('PUBLISHED');
        });
    });

    describe('INVALID_STATE — FAILED', () => {
        it('should return VALIDATION_ERROR with reason INVALID_STATE when post is FAILED', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(
                buildPostRow({ status: SocialPostStatusEnum.FAILED })
            );
            const { service } = buildService({ postModel });
            const input: PausePostInput = { actor: actorWithPausePerm, postId: POST_ID };

            // Act
            const result = await service.pause(input);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.reason).toBe('INVALID_STATE');
            expect(result.error?.message).toContain('FAILED');
        });
    });

    describe('FORBIDDEN', () => {
        it('should return FORBIDDEN when actor lacks SOCIAL_POST_PAUSE', async () => {
            // Arrange
            const { service } = buildService();
            const input: PausePostInput = { actor: actorWithoutPausePerm, postId: POST_ID };

            // Act
            const result = await service.pause(input);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });
});

// ---------------------------------------------------------------------------
// Tests — unpause (T-034)
// ---------------------------------------------------------------------------

describe('SocialPostService.unpause', () => {
    describe('happy path', () => {
        it('should set paused=false and call audit POST_UNPAUSED', async () => {
            // Arrange
            const auditLog = buildAuditLogMock();
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(
                buildPostRow({ status: SocialPostStatusEnum.APPROVED, paused: true })
            );
            postModel.update.mockResolvedValue(buildPostRow({ paused: false }));
            const { service } = buildService({ postModel, auditLog });
            const input: UnpausePostInput = { actor: actorWithPausePerm, postId: POST_ID };

            // Act
            const result = await service.unpause(input);

            // Assert — return value
            expect(result.error).toBeUndefined();
            expect(result.data).toMatchObject({ id: POST_ID, paused: false });

            // Assert — model updated with paused=false
            expect(postModel.update).toHaveBeenCalledWith(
                { id: POST_ID },
                expect.objectContaining({ paused: false, updatedById: ACTOR_ID })
            );

            // Assert — audit called with POST_UNPAUSED
            expect(auditLog.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    actorId: ACTOR_ID,
                    eventType: SocialAuditEvent.POST_UNPAUSED,
                    entityType: 'social_post',
                    entityId: POST_ID
                })
            );
        });
    });

    describe('FORBIDDEN', () => {
        it('should return FORBIDDEN when actor lacks SOCIAL_POST_PAUSE', async () => {
            // Arrange
            const { service } = buildService();
            const input: UnpausePostInput = { actor: actorWithoutPausePerm, postId: POST_ID };

            // Act
            const result = await service.unpause(input);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });
});

// ---------------------------------------------------------------------------
// Tests — archive (T-034)
// ---------------------------------------------------------------------------

describe('SocialPostService.archive', () => {
    describe('happy path', () => {
        it('should set status=ARCHIVED, deletedAt, deletedById, and call audit POST_ARCHIVED', async () => {
            // Arrange
            const auditLog = buildAuditLogMock();
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(
                buildPostRow({ status: SocialPostStatusEnum.APPROVED })
            );
            postModel.update.mockResolvedValue(
                buildPostRow({ status: SocialPostStatusEnum.ARCHIVED })
            );
            const { service } = buildService({ postModel, auditLog });
            const beforeCall = Date.now();
            const input: ArchivePostInput = { actor: actorWithArchivePerm, postId: POST_ID };

            // Act
            const result = await service.archive(input);
            const afterCall = Date.now();

            // Assert — return value
            expect(result.error).toBeUndefined();
            expect(result.data).toMatchObject({
                id: POST_ID,
                status: SocialPostStatusEnum.ARCHIVED
            });

            // Assert — single update call with status + soft-delete fields
            expect(postModel.update).toHaveBeenCalledWith(
                { id: POST_ID },
                expect.objectContaining({
                    status: SocialPostStatusEnum.ARCHIVED,
                    deletedById: ACTOR_ID,
                    updatedById: ACTOR_ID
                })
            );

            // Assert — deletedAt is approximately now
            const updateCall = (postModel.update as ReturnType<typeof vi.fn>).mock.calls[0];
            const updateData = updateCall?.[1] as Record<string, unknown>;
            const deletedAt = updateData?.deletedAt as Date;
            expect(deletedAt).toBeInstanceOf(Date);
            expect(deletedAt.getTime()).toBeGreaterThanOrEqual(beforeCall);
            expect(deletedAt.getTime()).toBeLessThanOrEqual(afterCall + 5);

            // Assert — audit called with POST_ARCHIVED
            expect(auditLog.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    actorId: ACTOR_ID,
                    eventType: SocialAuditEvent.POST_ARCHIVED,
                    entityType: 'social_post',
                    entityId: POST_ID,
                    newValue: expect.objectContaining({ status: SocialPostStatusEnum.ARCHIVED })
                })
            );
        });
    });

    describe('INVALID_STATE — PUBLISHING', () => {
        it('should return VALIDATION_ERROR with reason INVALID_STATE when post is PUBLISHING', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(
                buildPostRow({ status: SocialPostStatusEnum.PUBLISHING })
            );
            const { service } = buildService({ postModel });
            const input: ArchivePostInput = { actor: actorWithArchivePerm, postId: POST_ID };

            // Act
            const result = await service.archive(input);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.reason).toBe('INVALID_STATE');
            expect(result.error?.message).toContain('currently being published');
        });
    });

    describe('FORBIDDEN', () => {
        it('should return FORBIDDEN when actor lacks SOCIAL_POST_ARCHIVE', async () => {
            // Arrange
            const { service } = buildService();
            const input: ArchivePostInput = { actor: actorWithoutArchivePerm, postId: POST_ID };

            // Act
            const result = await service.archive(input);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('NOT_FOUND', () => {
        it('should return NOT_FOUND when post does not exist', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(null);
            const { service } = buildService({ postModel });
            const input: ArchivePostInput = { actor: actorWithArchivePerm, postId: POST_ID };

            // Act
            const result = await service.archive(input);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });
    });
});
