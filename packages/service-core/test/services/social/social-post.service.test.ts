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
 * listPosts (T-035):
 *   - FORBIDDEN when actor lacks SOCIAL_POST_VIEW
 *   - default pagination applied (page=1, pageSize=20)
 *   - pageSize clamped to 100
 *   - includeDeleted ignored when actor lacks SOCIAL_POST_HARD_DELETE
 *   - status/approvalStatus filters passed to where
 *   - platform filter resolves via targets two-step (returns empty when no targets)
 *   - platform filter resolves via targets two-step (happy path)
 *   - item shape includes platforms + thumbnailUrl
 *
 * getPostDetail (T-035):
 *   - FORBIDDEN when actor lacks SOCIAL_POST_VIEW
 *   - NOT_FOUND when post does not exist
 *   - happy path assembles targets/media/hashtags/publishLogs (10 limit)
 *
 * updatePost (T-035):
 *   - FORBIDDEN when actor lacks SOCIAL_POST_UPDATE
 *   - NOT_FOUND when post does not exist
 *   - happy path updates whitelisted fields; updatedById set
 *   - status/approvalStatus/paused STRIPPED even if passed in data
 *
 * promoteHashtag (T-035):
 *   - FORBIDDEN when actor lacks SOCIAL_HASHTAG_MANAGE
 *   - NOT_FOUND when post does not exist
 *   - new hashtag path: creates catalog row + link, isNew=true, audit called
 *   - existing hashtag path: no duplicate create, isNew=false
 *   - link-already-exists path: no duplicate link insert
 *   - auto-# warning when input lacks `#` prefix
 *
 * SPEC-254 T-033 / T-034 / T-035.
 */

import {
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    SocialApprovalStatusEnum,
    SocialPostStatusEnum,
    SocialRecurrenceTypeEnum
} from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import type { SocialAuditLogService } from '../../../src/services/social/social-audit-log.service';
import { SocialAuditEvent } from '../../../src/services/social/social-audit-log.service';
import type {
    ApprovePostInput,
    ArchivePostInput,
    GetPostDetailInput,
    ListPostsInput,
    MarkReadyPostInput,
    PausePostInput,
    PromoteHashtagInput,
    RejectPostInput,
    RequestChangesInput,
    SchedulePostInput,
    UnpausePostInput,
    UpdatePostInput
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
const HASHTAG_ID = '00000000-0000-4000-8000-000000000006';
const ASSET_ID = '00000000-0000-4000-8000-000000000007';

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

function buildActorWithView(hasPerm: boolean): Actor {
    return {
        id: ACTOR_ID,
        role: RoleEnum.ADMIN,
        permissions: hasPerm ? [PermissionEnum.SOCIAL_POST_VIEW] : []
    };
}

function buildActorWithViewAndHardDelete(): Actor {
    return {
        id: ACTOR_ID,
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.SOCIAL_POST_VIEW, PermissionEnum.SOCIAL_POST_HARD_DELETE]
    };
}

function buildActorWithUpdate(hasPerm: boolean): Actor {
    return {
        id: ACTOR_ID,
        role: RoleEnum.ADMIN,
        permissions: hasPerm ? [PermissionEnum.SOCIAL_POST_UPDATE] : []
    };
}

function buildActorWithHashtagManage(hasPerm: boolean): Actor {
    return {
        id: ACTOR_ID,
        role: RoleEnum.ADMIN,
        permissions: hasPerm ? [PermissionEnum.SOCIAL_HASHTAG_MANAGE] : []
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
const actorWithViewPerm = buildActorWithView(true);
const actorWithoutViewPerm = buildActorWithView(false);
const actorWithViewAndHardDeletePerm = buildActorWithViewAndHardDelete();
const actorWithUpdatePerm = buildActorWithUpdate(true);
const actorWithoutUpdatePerm = buildActorWithUpdate(false);
const actorWithHashtagManagePerm = buildActorWithHashtagManage(true);
const actorWithoutHashtagManagePerm = buildActorWithHashtagManage(false);

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
// Additional row fixtures (T-035)
// ---------------------------------------------------------------------------

function buildHashtagRow(overrides: Record<string, unknown> = {}) {
    return {
        id: HASHTAG_ID,
        hashtag: '#verano',
        normalizedHashtag: '#verano',
        category: 'seasonal',
        platform: null,
        audienceId: null,
        priority: 0,
        active: true,
        createdAt: new Date(),
        ...overrides
    };
}

function buildPostHashtagRow(overrides: Record<string, unknown> = {}) {
    return {
        id: '00000000-0000-4000-8000-000000000008',
        socialPostId: POST_ID,
        hashtagId: HASHTAG_ID,
        position: 0,
        createdAt: new Date(),
        ...overrides
    };
}

function buildAssetRow(overrides: Record<string, unknown> = {}) {
    return {
        id: ASSET_ID,
        cloudinaryUrl: 'https://res.cloudinary.com/example/image/upload/v1/test.jpg',
        mediaType: 'IMAGE',
        source: 'GPT',
        deletedAt: null,
        ...overrides
    };
}

function buildPublishLogRow(overrides: Record<string, unknown> = {}) {
    return {
        id: '00000000-0000-4000-8000-000000000009',
        socialPostId: POST_ID,
        status: 'PUBLISHED',
        createdAt: new Date(),
        ...overrides
    };
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
    hashtagModel?: ReturnType<typeof createModelMock>;
    postHashtagModel?: ReturnType<typeof createModelMock>;
    assetModel?: ReturnType<typeof createModelMock>;
    publishLogModel?: ReturnType<typeof createModelMock>;
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

    const hashtagModel =
        opts.hashtagModel ??
        (() => {
            const m = createModelMock();
            m.findOne.mockResolvedValue(null);
            m.create.mockResolvedValue(buildHashtagRow());
            return m;
        })();

    const postHashtagModel =
        opts.postHashtagModel ??
        (() => {
            const m = createModelMock();
            m.findOne.mockResolvedValue(null);
            m.findAll.mockResolvedValue({ items: [], total: 0 });
            m.create.mockResolvedValue(buildPostHashtagRow());
            return m;
        })();

    const assetModel =
        opts.assetModel ??
        (() => {
            const m = createModelMock();
            m.findOne.mockResolvedValue(buildAssetRow());
            return m;
        })();

    const publishLogModel =
        opts.publishLogModel ??
        (() => {
            const m = createModelMock();
            m.findAll.mockResolvedValue({ items: [], total: 0 });
            return m;
        })();

    const auditLog = opts.auditLog ?? buildAuditLogMock();

    const service = new SocialPostService(
        {},
        postModel as never,
        postTargetModel as never,
        postMediaModel as never,
        platformFormatModel as never,
        auditLog,
        hashtagModel as never,
        postHashtagModel as never,
        assetModel as never,
        publishLogModel as never
    );

    return {
        service,
        postModel,
        postTargetModel,
        postMediaModel,
        platformFormatModel,
        auditLog,
        hashtagModel,
        postHashtagModel,
        assetModel,
        publishLogModel
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

    // -------------------------------------------------------------------------
    // Recurrence persistence (SPEC-254)
    // -------------------------------------------------------------------------

    describe('recurrence — WEEKLY with weekday', () => {
        it('should persist recurrenceType=WEEKLY and recurrenceParamsJson with weekday', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(
                buildPostRow({ status: SocialPostStatusEnum.APPROVED })
            );
            postModel.update.mockResolvedValue(
                buildPostRow({ status: SocialPostStatusEnum.SCHEDULED })
            );
            const { service } = buildService({ postModel });
            const futureDate = new Date(Date.now() + 60_000);
            const input: SchedulePostInput = {
                actor: actorWithSchedulePerm,
                postId: POST_ID,
                scheduledAt: futureDate,
                timezone: 'UTC',
                recurrenceType: SocialRecurrenceTypeEnum.WEEKLY,
                recurrenceParamsJson: { weekday: 'TUESDAY' }
            };

            // Act
            const result = await service.schedule(input);

            // Assert — no error
            expect(result.error).toBeUndefined();

            // Assert — model updated with recurrenceType and recurrenceParamsJson
            expect(postModel.update).toHaveBeenCalledWith(
                { id: POST_ID },
                expect.objectContaining({
                    recurrenceType: SocialRecurrenceTypeEnum.WEEKLY,
                    recurrenceParamsJson: { weekday: 'TUESDAY' }
                })
            );
        });
    });

    describe('recurrence — ONCE clears recurrenceParamsJson', () => {
        it('should persist recurrenceType=ONCE and recurrenceParamsJson=null regardless of input', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(
                buildPostRow({ status: SocialPostStatusEnum.APPROVED })
            );
            postModel.update.mockResolvedValue(
                buildPostRow({ status: SocialPostStatusEnum.SCHEDULED })
            );
            const { service } = buildService({ postModel });
            const futureDate = new Date(Date.now() + 60_000);
            const input: SchedulePostInput = {
                actor: actorWithSchedulePerm,
                postId: POST_ID,
                scheduledAt: futureDate,
                timezone: 'UTC',
                recurrenceType: SocialRecurrenceTypeEnum.ONCE
                // No recurrenceParamsJson provided
            };

            // Act
            const result = await service.schedule(input);

            // Assert — no error
            expect(result.error).toBeUndefined();

            // Assert — recurrenceParamsJson is explicitly null for ONCE
            expect(postModel.update).toHaveBeenCalledWith(
                { id: POST_ID },
                expect.objectContaining({
                    recurrenceType: SocialRecurrenceTypeEnum.ONCE,
                    recurrenceParamsJson: null
                })
            );
        });

        it('should default recurrenceType to ONCE and set recurrenceParamsJson=null when neither is provided', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(
                buildPostRow({ status: SocialPostStatusEnum.APPROVED })
            );
            postModel.update.mockResolvedValue(
                buildPostRow({ status: SocialPostStatusEnum.SCHEDULED })
            );
            const { service } = buildService({ postModel });
            const futureDate = new Date(Date.now() + 60_000);
            const input: SchedulePostInput = {
                actor: actorWithSchedulePerm,
                postId: POST_ID,
                scheduledAt: futureDate,
                timezone: 'UTC'
                // recurrenceType intentionally omitted — should default to ONCE
            };

            // Act
            const result = await service.schedule(input);

            // Assert
            expect(result.error).toBeUndefined();
            expect(postModel.update).toHaveBeenCalledWith(
                { id: POST_ID },
                expect.objectContaining({
                    recurrenceType: SocialRecurrenceTypeEnum.ONCE,
                    recurrenceParamsJson: null
                })
            );
        });
    });

    describe('recurrence — BIWEEKLY clears recurrenceParamsJson', () => {
        it('should persist recurrenceType=BIWEEKLY and recurrenceParamsJson=null', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(
                buildPostRow({ status: SocialPostStatusEnum.APPROVED })
            );
            postModel.update.mockResolvedValue(
                buildPostRow({ status: SocialPostStatusEnum.SCHEDULED })
            );
            const { service } = buildService({ postModel });
            const futureDate = new Date(Date.now() + 60_000);
            const input: SchedulePostInput = {
                actor: actorWithSchedulePerm,
                postId: POST_ID,
                scheduledAt: futureDate,
                timezone: 'UTC',
                recurrenceType: SocialRecurrenceTypeEnum.BIWEEKLY
            };

            // Act
            const result = await service.schedule(input);

            // Assert
            expect(result.error).toBeUndefined();
            expect(postModel.update).toHaveBeenCalledWith(
                { id: POST_ID },
                expect.objectContaining({
                    recurrenceType: SocialRecurrenceTypeEnum.BIWEEKLY,
                    recurrenceParamsJson: null
                })
            );
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

// ---------------------------------------------------------------------------
// Tests — listPosts (T-035)
// ---------------------------------------------------------------------------

describe('SocialPostService.listPosts', () => {
    describe('FORBIDDEN', () => {
        it('should return FORBIDDEN when actor lacks SOCIAL_POST_VIEW', async () => {
            // Arrange
            const { service } = buildService();
            const input: ListPostsInput = { actor: actorWithoutViewPerm };

            // Act
            const result = await service.listPosts(input);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('default pagination', () => {
        it('should apply page=1 and pageSize=20 when no filters provided', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findAll.mockResolvedValue({ items: [buildPostRow()], total: 1 });
            const { service } = buildService({ postModel });
            const input: ListPostsInput = { actor: actorWithViewPerm };

            // Act
            const result = await service.listPosts(input);

            // Assert
            expect(result.error).toBeUndefined();
            expect(postModel.findAll).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({ page: 1, pageSize: 20 }),
                expect.any(Array)
            );
        });
    });

    describe('pageSize clamping', () => {
        it('should clamp pageSize to 100 when value exceeds 100', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findAll.mockResolvedValue({ items: [], total: 0 });
            const { service } = buildService({ postModel });
            const input: ListPostsInput = {
                actor: actorWithViewPerm,
                filters: { pageSize: 500 }
            };

            // Act
            await service.listPosts(input);

            // Assert
            expect(postModel.findAll).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({ pageSize: 100 }),
                expect.any(Array)
            );
        });
    });

    describe('includeDeleted — ignored without SOCIAL_POST_HARD_DELETE', () => {
        it('should force includeDeleted=false when actor lacks SOCIAL_POST_HARD_DELETE', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findAll.mockResolvedValue({ items: [], total: 0 });
            const { service } = buildService({ postModel });
            const input: ListPostsInput = {
                actor: actorWithViewPerm,
                // actorWithViewPerm does NOT have SOCIAL_POST_HARD_DELETE
                filters: { includeDeleted: true }
            };

            // Act
            await service.listPosts(input);

            // Assert — the where clause must include deletedAt: null
            expect(postModel.findAll).toHaveBeenCalledWith(
                expect.objectContaining({ deletedAt: null }),
                expect.any(Object),
                expect.any(Array)
            );
        });

        it('should honour includeDeleted=true when actor holds SOCIAL_POST_HARD_DELETE', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findAll.mockResolvedValue({ items: [], total: 0 });
            const { service } = buildService({ postModel });
            const input: ListPostsInput = {
                actor: actorWithViewAndHardDeletePerm,
                filters: { includeDeleted: true }
            };

            // Act
            await service.listPosts(input);

            // Assert — deletedAt should NOT be in the where clause
            const whereArg = (postModel.findAll as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
            expect(whereArg).not.toHaveProperty('deletedAt');
        });
    });

    describe('status and approvalStatus filters', () => {
        it('should pass status and approvalStatus into the where clause', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findAll.mockResolvedValue({ items: [], total: 0 });
            const { service } = buildService({ postModel });
            const input: ListPostsInput = {
                actor: actorWithViewPerm,
                filters: {
                    status: SocialPostStatusEnum.APPROVED,
                    approvalStatus: SocialApprovalStatusEnum.APPROVED
                }
            };

            // Act
            await service.listPosts(input);

            // Assert
            expect(postModel.findAll).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: SocialPostStatusEnum.APPROVED,
                    approvalStatus: SocialApprovalStatusEnum.APPROVED
                }),
                expect.any(Object),
                expect.any(Array)
            );
        });
    });

    describe('platform filter — empty targets', () => {
        it('should return empty items when no targets match the platform', async () => {
            // Arrange
            const postTargetModel = createModelMock();
            postTargetModel.findAll.mockResolvedValue({ items: [], total: 0 });
            const { service } = buildService({ postTargetModel });
            const input: ListPostsInput = {
                actor: actorWithViewPerm,
                filters: { platform: 'TIKTOK' }
            };

            // Act
            const result = await service.listPosts(input);

            // Assert — early return with empty items
            expect(result.error).toBeUndefined();
            expect(result.data?.items).toHaveLength(0);
            expect(result.data?.total).toBe(0);
        });
    });

    describe('platform filter — happy path', () => {
        it('should filter posts to those with a matching target platform', async () => {
            // Arrange
            const postModel = createModelMock();
            const postRow = buildPostRow();
            postModel.findAll.mockResolvedValue({ items: [postRow], total: 1 });

            const postTargetModel = createModelMock();
            // First call: resolve platform filter → return a target with our POST_ID
            // Subsequent calls (per-post enrichment): return platforms for the post
            postTargetModel.findAll
                .mockResolvedValueOnce({
                    items: [buildTargetRow({ platform: 'INSTAGRAM' })],
                    total: 1
                })
                .mockResolvedValue({
                    items: [buildTargetRow({ platform: 'INSTAGRAM' })],
                    total: 1
                });

            const postMediaModel = createModelMock();
            postMediaModel.findAll.mockResolvedValue({ items: [], total: 0 });

            const { service } = buildService({ postModel, postTargetModel, postMediaModel });
            const input: ListPostsInput = {
                actor: actorWithViewPerm,
                filters: { platform: 'INSTAGRAM' }
            };

            // Act
            const result = await service.listPosts(input);

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.items).toHaveLength(1);
        });
    });

    describe('item shape', () => {
        it('should return item with platforms and thumbnailUrl from asset', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findAll.mockResolvedValue({ items: [buildPostRow()], total: 1 });

            const postTargetModel = createModelMock();
            postTargetModel.findAll.mockResolvedValue({
                items: [buildTargetRow({ platform: 'INSTAGRAM' })],
                total: 1
            });

            const postMediaModel = createModelMock();
            postMediaModel.findAll.mockResolvedValue({
                items: [{ ...buildMediaRow(), assetId: ASSET_ID }],
                total: 1
            });

            const assetModel = createModelMock();
            assetModel.findOne.mockResolvedValue(buildAssetRow());

            const { service } = buildService({
                postModel,
                postTargetModel,
                postMediaModel,
                assetModel
            });
            const input: ListPostsInput = { actor: actorWithViewPerm };

            // Act
            const result = await service.listPosts(input);

            // Assert
            expect(result.error).toBeUndefined();
            const item = result.data?.items[0];
            expect(item).toBeDefined();
            expect(item?.platforms).toContain('INSTAGRAM');
            expect(item?.thumbnailUrl).toBe(
                'https://res.cloudinary.com/example/image/upload/v1/test.jpg'
            );
            expect(item?.id).toBe(POST_ID);
        });

        it('should return thumbnailUrl=null when post has no media', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findAll.mockResolvedValue({ items: [buildPostRow()], total: 1 });

            const postTargetModel = createModelMock();
            postTargetModel.findAll.mockResolvedValue({ items: [], total: 0 });

            const postMediaModel = createModelMock();
            postMediaModel.findAll.mockResolvedValue({ items: [], total: 0 });

            const { service } = buildService({ postModel, postTargetModel, postMediaModel });
            const input: ListPostsInput = { actor: actorWithViewPerm };

            // Act
            const result = await service.listPosts(input);

            // Assert
            expect(result.data?.items[0]?.thumbnailUrl).toBeNull();
        });
    });
});

// ---------------------------------------------------------------------------
// Tests — getPostDetail (T-035)
// ---------------------------------------------------------------------------

describe('SocialPostService.getPostDetail', () => {
    describe('FORBIDDEN', () => {
        it('should return FORBIDDEN when actor lacks SOCIAL_POST_VIEW', async () => {
            // Arrange
            const { service } = buildService();
            const input: GetPostDetailInput = { actor: actorWithoutViewPerm, postId: POST_ID };

            // Act
            const result = await service.getPostDetail(input);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('NOT_FOUND', () => {
        it('should return NOT_FOUND when post does not exist or is soft-deleted', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(null);
            const { service } = buildService({ postModel });
            const input: GetPostDetailInput = { actor: actorWithViewPerm, postId: POST_ID };

            // Act
            const result = await service.getPostDetail(input);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });
    });

    describe('happy path', () => {
        it('should assemble targets, media (with cloudinaryUrl), hashtags, and publishLogs (max 10)', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(
                buildPostRow({ captionBase: 'Hello world', gptHashtagPayloadJson: ['#verano'] })
            );

            const postTargetModel = createModelMock();
            postTargetModel.findAll.mockResolvedValue({
                items: [buildTargetRow()],
                total: 1
            });

            const postMediaModel = createModelMock();
            postMediaModel.findAll.mockResolvedValue({
                items: [{ ...buildMediaRow(), assetId: ASSET_ID }],
                total: 1
            });

            const assetModel = createModelMock();
            assetModel.findOne.mockResolvedValue(buildAssetRow());

            const postHashtagModel = createModelMock();
            postHashtagModel.findAll.mockResolvedValue({
                items: [buildPostHashtagRow()],
                total: 1
            });

            const hashtagModel = createModelMock();
            hashtagModel.findOne.mockResolvedValue(buildHashtagRow());

            // Simulate 10 publish logs (the limit)
            const logItems = Array.from({ length: 10 }, (_, i) =>
                buildPublishLogRow({ id: `log-${i}` })
            );
            const publishLogModel = createModelMock();
            publishLogModel.findAll.mockResolvedValue({ items: logItems, total: 15 });

            const { service } = buildService({
                postModel,
                postTargetModel,
                postMediaModel,
                assetModel,
                postHashtagModel,
                hashtagModel,
                publishLogModel
            });
            const input: GetPostDetailInput = { actor: actorWithViewPerm, postId: POST_ID };

            // Act
            const result = await service.getPostDetail(input);

            // Assert
            expect(result.error).toBeUndefined();
            const detail = result.data;
            expect(detail?.id).toBe(POST_ID);
            expect(detail?.captionBase).toBe('Hello world');

            // Targets assembled
            expect(detail?.targets).toHaveLength(1);

            // Media enriched with cloudinaryUrl
            expect(detail?.media).toHaveLength(1);
            expect((detail?.media[0] as Record<string, unknown>)?.cloudinaryUrl).toBe(
                'https://res.cloudinary.com/example/image/upload/v1/test.jpg'
            );

            // Hashtags resolved from catalog
            expect(detail?.hashtags).toContain('#verano');

            // publishLogs limited to 10 (findAll called with pageSize=10)
            expect(detail?.publishLogs).toHaveLength(10);
            expect(publishLogModel.findAll).toHaveBeenCalledWith(
                expect.objectContaining({ socialPostId: POST_ID }),
                expect.objectContaining({ pageSize: 10, sortOrder: 'desc' })
            );
        });
    });
});

// ---------------------------------------------------------------------------
// Tests — updatePost (T-035)
// ---------------------------------------------------------------------------

describe('SocialPostService.updatePost', () => {
    describe('FORBIDDEN', () => {
        it('should return FORBIDDEN when actor lacks SOCIAL_POST_UPDATE', async () => {
            // Arrange
            const { service } = buildService();
            const input: UpdatePostInput = {
                actor: actorWithoutUpdatePerm,
                postId: POST_ID,
                data: { title: 'New title' }
            };

            // Act
            const result = await service.updatePost(input);

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
            const input: UpdatePostInput = {
                actor: actorWithUpdatePerm,
                postId: POST_ID,
                data: { title: 'New title' }
            };

            // Act
            const result = await service.updatePost(input);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });
    });

    describe('happy path — whitelisted fields', () => {
        it('should update whitelisted fields and set updatedById=actor.id', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(buildPostRow());
            const updatedRow = buildPostRow({ title: 'New title', notes: 'Admin note' });
            postModel.update.mockResolvedValue(updatedRow);
            const { service } = buildService({ postModel });
            const input: UpdatePostInput = {
                actor: actorWithUpdatePerm,
                postId: POST_ID,
                data: { title: 'New title', notes: 'Admin note' }
            };

            // Act
            const result = await service.updatePost(input);

            // Assert
            expect(result.error).toBeUndefined();
            expect(postModel.update).toHaveBeenCalledWith(
                { id: POST_ID },
                expect.objectContaining({
                    title: 'New title',
                    notes: 'Admin note',
                    updatedById: ACTOR_ID
                })
            );
        });
    });

    describe('stripped fields — status/approvalStatus/paused must not be passed to update', () => {
        it('should NOT pass status, approvalStatus, or paused to postModel.update', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(buildPostRow());
            postModel.update.mockResolvedValue(buildPostRow());
            const { service } = buildService({ postModel });

            // Pass the forbidden fields in data (they must be silently stripped).
            // Casting as never lets us inject forbidden fields at the type level so we
            // can assert the runtime whitelist strips them without TS errors.
            const rawData = {
                title: 'Safe update',
                status: SocialPostStatusEnum.PUBLISHED,
                approvalStatus: SocialApprovalStatusEnum.APPROVED,
                paused: true
            };
            const input: UpdatePostInput = {
                actor: actorWithUpdatePerm,
                postId: POST_ID,
                data: rawData as never
            };

            // Act
            const result = await service.updatePost(input);

            // Assert — update called without the forbidden fields
            expect(result.error).toBeUndefined();
            const patchArg = (postModel.update as ReturnType<typeof vi.fn>).mock.calls[0]?.[1];
            expect(patchArg).not.toHaveProperty('status');
            expect(patchArg).not.toHaveProperty('approvalStatus');
            expect(patchArg).not.toHaveProperty('paused');
            // But title is there
            expect(patchArg).toHaveProperty('title', 'Safe update');
        });
    });
});

// ---------------------------------------------------------------------------
// Tests — promoteHashtag (T-035)
// ---------------------------------------------------------------------------

describe('SocialPostService.promoteHashtag', () => {
    describe('FORBIDDEN', () => {
        it('should return FORBIDDEN when actor lacks SOCIAL_HASHTAG_MANAGE', async () => {
            // Arrange
            const { service } = buildService();
            const input: PromoteHashtagInput = {
                actor: actorWithoutHashtagManagePerm,
                postId: POST_ID,
                hashtag: '#verano',
                category: 'seasonal'
            };

            // Act
            const result = await service.promoteHashtag(input);

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
            const input: PromoteHashtagInput = {
                actor: actorWithHashtagManagePerm,
                postId: POST_ID,
                hashtag: '#verano',
                category: 'seasonal'
            };

            // Act
            const result = await service.promoteHashtag(input);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });
    });

    describe('new hashtag path', () => {
        it('should create catalog row + link, return isNew=true, and call audit HASHTAG_PROMOTED', async () => {
            // Arrange
            const auditLog = buildAuditLogMock();
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(buildPostRow());

            const hashtagModel = createModelMock();
            hashtagModel.findOne.mockResolvedValue(null); // not found → create
            hashtagModel.create.mockResolvedValue(buildHashtagRow());

            const postHashtagModel = createModelMock();
            postHashtagModel.findOne.mockResolvedValue(null);
            postHashtagModel.create.mockResolvedValue(buildPostHashtagRow());

            const { service } = buildService({
                postModel,
                hashtagModel,
                postHashtagModel,
                auditLog
            });
            const input: PromoteHashtagInput = {
                actor: actorWithHashtagManagePerm,
                postId: POST_ID,
                hashtag: '#verano',
                category: 'seasonal'
            };

            // Act
            const result = await service.promoteHashtag(input);

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.isNew).toBe(true);
            expect(result.data?.hashtag).toBe('#verano');
            expect(result.data?.hashtagId).toBe(HASHTAG_ID);

            // Catalog row created
            expect(hashtagModel.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    normalizedHashtag: '#verano',
                    category: 'seasonal',
                    active: true,
                    createdById: ACTOR_ID
                })
            );

            // Link created
            expect(postHashtagModel.create).toHaveBeenCalledWith(
                expect.objectContaining({ socialPostId: POST_ID, hashtagId: HASHTAG_ID })
            );

            // Audit log called with HASHTAG_PROMOTED
            expect(auditLog.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    actorId: ACTOR_ID,
                    eventType: SocialAuditEvent.HASHTAG_PROMOTED,
                    entityType: 'social_post',
                    entityId: POST_ID,
                    metadata: expect.objectContaining({ isNew: true, normalizedHashtag: '#verano' })
                })
            );
        });
    });

    describe('existing hashtag path', () => {
        it('should NOT create catalog row, return isNew=false, and create link', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(buildPostRow());

            const hashtagModel = createModelMock();
            hashtagModel.findOne.mockResolvedValue(buildHashtagRow()); // exists
            hashtagModel.create.mockResolvedValue(buildHashtagRow());

            const postHashtagModel = createModelMock();
            postHashtagModel.findOne.mockResolvedValue(null); // link not yet created
            postHashtagModel.create.mockResolvedValue(buildPostHashtagRow());

            const { service } = buildService({ postModel, hashtagModel, postHashtagModel });
            const input: PromoteHashtagInput = {
                actor: actorWithHashtagManagePerm,
                postId: POST_ID,
                hashtag: '#verano',
                category: 'seasonal'
            };

            // Act
            const result = await service.promoteHashtag(input);

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.isNew).toBe(false);

            // Catalog row must NOT be created again
            expect(hashtagModel.create).not.toHaveBeenCalled();

            // Link created once
            expect(postHashtagModel.create).toHaveBeenCalledTimes(1);
        });
    });

    describe('link-already-exists path', () => {
        it('should NOT create a duplicate link when (postId, hashtagId) link already exists', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(buildPostRow());

            const hashtagModel = createModelMock();
            hashtagModel.findOne.mockResolvedValue(buildHashtagRow()); // exists

            const postHashtagModel = createModelMock();
            postHashtagModel.findOne.mockResolvedValue(buildPostHashtagRow()); // link also exists
            postHashtagModel.create.mockResolvedValue(buildPostHashtagRow());

            const { service } = buildService({ postModel, hashtagModel, postHashtagModel });
            const input: PromoteHashtagInput = {
                actor: actorWithHashtagManagePerm,
                postId: POST_ID,
                hashtag: '#verano',
                category: 'seasonal'
            };

            // Act
            const result = await service.promoteHashtag(input);

            // Assert — link create must NOT be called (already exists)
            expect(result.error).toBeUndefined();
            expect(postHashtagModel.create).not.toHaveBeenCalled();
        });
    });

    describe('auto-# prefix warning', () => {
        it('should auto-prepend # and include a warning when input lacks # prefix', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(buildPostRow());

            const hashtagModel = createModelMock();
            hashtagModel.findOne.mockResolvedValue(null);
            hashtagModel.create.mockResolvedValue(buildHashtagRow());

            const postHashtagModel = createModelMock();
            postHashtagModel.findOne.mockResolvedValue(null);
            postHashtagModel.create.mockResolvedValue(buildPostHashtagRow());

            const { service } = buildService({ postModel, hashtagModel, postHashtagModel });
            const input: PromoteHashtagInput = {
                actor: actorWithHashtagManagePerm,
                postId: POST_ID,
                hashtag: 'verano', // no # prefix
                category: 'seasonal'
            };

            // Act
            const result = await service.promoteHashtag(input);

            // Assert
            expect(result.error).toBeUndefined();
            // Normalized hashtag returned
            expect(result.data?.hashtag).toBe('#verano');
            // Warning present
            expect(result.data?.warnings).toHaveLength(1);
            expect(result.data?.warnings[0]?.field).toBe('hashtag');
            expect(result.data?.warnings[0]?.message).toContain('# prefix auto-added');
        });

        it('should NOT include a warning when input already has # prefix', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(buildPostRow());

            const hashtagModel = createModelMock();
            hashtagModel.findOne.mockResolvedValue(null);
            hashtagModel.create.mockResolvedValue(buildHashtagRow());

            const postHashtagModel = createModelMock();
            postHashtagModel.findOne.mockResolvedValue(null);
            postHashtagModel.create.mockResolvedValue(buildPostHashtagRow());

            const { service } = buildService({ postModel, hashtagModel, postHashtagModel });
            const input: PromoteHashtagInput = {
                actor: actorWithHashtagManagePerm,
                postId: POST_ID,
                hashtag: '#verano', // already has #
                category: 'seasonal'
            };

            // Act
            const result = await service.promoteHashtag(input);

            // Assert
            expect(result.data?.warnings).toHaveLength(0);
        });
    });
});
