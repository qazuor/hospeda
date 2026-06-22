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
 * SPEC-254 T-033.
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
    RejectPostInput,
    RequestChangesInput
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

const actorWithPerm = buildActor(true);
const actorWithoutPerm = buildActor(false);

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
