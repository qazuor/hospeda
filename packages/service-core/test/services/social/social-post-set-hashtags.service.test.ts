/**
 * Unit tests for SocialPostService.setPostHashtags
 *
 * All DB interactions are mocked — no real Postgres calls.
 * SocialAuditLogService is also mocked.
 *
 * Covers:
 *
 * setPostHashtags:
 *   - FORBIDDEN when actor lacks SOCIAL_POST_UPDATE
 *   - NOT_FOUND when post does not exist
 *   - happy path: adds new hashtags from catalog
 *   - happy path: creates new catalog row when hashtag not in catalog
 *   - happy path: removes links that are no longer in the set
 *   - happy path: reorders existing links (updates position)
 *   - happy path: regenerates finalHashtagsText joined by space
 *   - deduplicates normalized hashtags (first occurrence wins)
 *   - auto-prepends `#` when missing
 *   - empty array clears all hashtags
 *   - emits POST_HASHTAGS_UPDATED audit log with correct metadata
 *
 * SPEC-254.
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
import type { SetPostHashtagsInput } from '../../../src/services/social/social-post.service';
import { SocialPostService } from '../../../src/services/social/social-post.service';
import type { Actor } from '../../../src/types';
import { createModelMock } from '../../utils/modelMockFactory';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POST_ID = '00000000-0000-4000-8000-000000000001';
const ACTOR_ID = '00000000-0000-4000-8000-000000000002';
const HASHTAG_ID_1 = '00000000-0000-4000-8000-000000000010';
const HASHTAG_ID_2 = '00000000-0000-4000-8000-000000000011';
const HASHTAG_ID_3 = '00000000-0000-4000-8000-000000000012';
const LINK_ID_1 = '00000000-0000-4000-8000-000000000020';
const LINK_ID_2 = '00000000-0000-4000-8000-000000000021';

// ---------------------------------------------------------------------------
// Actor fixtures
// ---------------------------------------------------------------------------

function buildActorWithUpdate(hasPerm: boolean): Actor {
    return {
        id: ACTOR_ID,
        role: RoleEnum.ADMIN,
        permissions: hasPerm ? [PermissionEnum.SOCIAL_POST_UPDATE] : []
    };
}

const actorWithUpdatePerm = buildActorWithUpdate(true);
const actorWithoutUpdatePerm = buildActorWithUpdate(false);

// ---------------------------------------------------------------------------
// Row fixtures
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
        batchId: null,
        campaignId: null,
        finalHashtagsText: null,
        ...overrides
    };
}

function buildHashtagRow(
    id: string,
    normalizedHashtag: string,
    overrides: Record<string, unknown> = {}
) {
    return {
        id,
        hashtag: normalizedHashtag,
        normalizedHashtag,
        category: 'general',
        platform: null,
        audienceId: null,
        priority: 0,
        active: true,
        createdAt: new Date(),
        ...overrides
    };
}

function buildLinkRow(id: string, hashtagId: string, position: number) {
    return {
        id,
        socialPostId: POST_ID,
        hashtagId,
        position,
        createdAt: new Date()
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
    hashtagModel?: ReturnType<typeof createModelMock>;
    postHashtagModel?: ReturnType<typeof createModelMock>;
    batchModel?: ReturnType<typeof createModelMock>;
    campaignModel?: ReturnType<typeof createModelMock>;
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

    const hashtagModel =
        opts.hashtagModel ??
        (() => {
            const m = createModelMock();
            m.findOne.mockResolvedValue(null);
            m.create.mockImplementation((data: Record<string, unknown>) =>
                Promise.resolve({ ...data, id: HASHTAG_ID_1, createdAt: new Date() })
            );
            return m;
        })();

    const postHashtagModel =
        opts.postHashtagModel ??
        (() => {
            const m = createModelMock();
            m.findAll.mockResolvedValue({ items: [], total: 0 });
            m.create.mockResolvedValue({});
            m.hardDelete.mockResolvedValue(undefined);
            m.update.mockResolvedValue({});
            return m;
        })();

    const batchModel =
        opts.batchModel ??
        (() => {
            const m = createModelMock();
            m.findOne.mockResolvedValue(null);
            return m;
        })();

    const campaignModel =
        opts.campaignModel ??
        (() => {
            const m = createModelMock();
            m.findOne.mockResolvedValue(null);
            return m;
        })();

    const auditLog = opts.auditLog ?? buildAuditLogMock();

    // SocialPostService constructor: config, postModel, postTargetModel,
    // postMediaModel, platformFormatModel, auditLog, hashtagModel,
    // postHashtagModel, assetModel, publishLogModel, settingModel,
    // batchModel, campaignModel
    const postTargetModel = createModelMock();
    postTargetModel.findAll.mockResolvedValue({ items: [], total: 0 });
    const postMediaModel = createModelMock();
    postMediaModel.findAll.mockResolvedValue({ items: [], total: 0 });
    const platformFormatModel = createModelMock();
    const assetModel = createModelMock();
    const publishLogModel = createModelMock();
    publishLogModel.findAll.mockResolvedValue({ items: [], total: 0 });
    const settingModel = createModelMock();

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
        publishLogModel as never,
        settingModel as never,
        batchModel as never,
        campaignModel as never
    );

    return {
        service,
        postModel,
        hashtagModel,
        postHashtagModel,
        batchModel,
        campaignModel,
        auditLog
    };
}

// ---------------------------------------------------------------------------
// Tests — setPostHashtags
// ---------------------------------------------------------------------------

describe('SocialPostService.setPostHashtags', () => {
    describe('when actor lacks SOCIAL_POST_UPDATE', () => {
        it('should return FORBIDDEN error', async () => {
            // Arrange
            const { service } = buildService();
            const input: SetPostHashtagsInput = {
                actor: actorWithoutUpdatePerm,
                postId: POST_ID,
                hashtags: ['#playa']
            };

            // Act
            const result = await service.setPostHashtags(input);

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(result.data).toBeUndefined();
        });
    });

    describe('when post does not exist', () => {
        it('should return NOT_FOUND error', async () => {
            // Arrange
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(null);
            const { service } = buildService({ postModel });
            const input: SetPostHashtagsInput = {
                actor: actorWithUpdatePerm,
                postId: POST_ID,
                hashtags: ['#playa']
            };

            // Act
            const result = await service.setPostHashtags(input);

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
            expect(result.data).toBeUndefined();
        });
    });

    describe('happy path — adds hashtags from existing catalog', () => {
        it('should resolve existing catalog row (isNew=false) and create link', async () => {
            // Arrange
            const hashtagModel = createModelMock();
            hashtagModel.findOne.mockResolvedValue(buildHashtagRow(HASHTAG_ID_1, '#playa'));

            const postHashtagModel = createModelMock();
            postHashtagModel.findAll.mockResolvedValue({ items: [], total: 0 });
            postHashtagModel.create.mockResolvedValue({});

            const auditLog = buildAuditLogMock();
            const { service } = buildService({ hashtagModel, postHashtagModel, auditLog });

            const input: SetPostHashtagsInput = {
                actor: actorWithUpdatePerm,
                postId: POST_ID,
                hashtags: ['#playa']
            };

            // Act
            const result = await service.setPostHashtags(input);

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.hashtags).toHaveLength(1);
            expect(result.data?.hashtags[0]).toMatchObject({
                hashtagId: HASHTAG_ID_1,
                hashtag: '#playa',
                isNew: false
            });
            expect(result.data?.finalHashtagsText).toBe('#playa');
        });
    });

    describe('happy path — creates new catalog row when hashtag not in catalog', () => {
        it('should create catalog row and link, returning isNew=true', async () => {
            // Arrange
            const hashtagModel = createModelMock();
            hashtagModel.findOne.mockResolvedValue(null);
            hashtagModel.create.mockResolvedValue(buildHashtagRow(HASHTAG_ID_1, '#verano'));

            const postHashtagModel = createModelMock();
            postHashtagModel.findAll.mockResolvedValue({ items: [], total: 0 });
            postHashtagModel.create.mockResolvedValue({});

            const { service } = buildService({ hashtagModel, postHashtagModel });

            const input: SetPostHashtagsInput = {
                actor: actorWithUpdatePerm,
                postId: POST_ID,
                hashtags: ['#verano']
            };

            // Act
            const result = await service.setPostHashtags(input);

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.hashtags[0]).toMatchObject({
                hashtagId: HASHTAG_ID_1,
                hashtag: '#verano',
                isNew: true
            });
            expect(hashtagModel.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    normalizedHashtag: '#verano',
                    category: 'general',
                    active: true,
                    createdById: ACTOR_ID
                })
            );
        });
    });

    describe('happy path — removes links that are no longer in the set', () => {
        it('should hard-delete the removed link', async () => {
            // Arrange
            const hashtagModel = createModelMock();
            hashtagModel.findOne.mockResolvedValue(buildHashtagRow(HASHTAG_ID_1, '#playa'));

            // Current links: #playa (stays) and #verano (to be removed)
            const postHashtagModel = createModelMock();
            postHashtagModel.findAll.mockResolvedValue({
                items: [
                    buildLinkRow(LINK_ID_1, HASHTAG_ID_1, 0),
                    buildLinkRow(LINK_ID_2, HASHTAG_ID_2, 1)
                ],
                total: 2
            });
            postHashtagModel.hardDelete.mockResolvedValue(undefined);
            postHashtagModel.update.mockResolvedValue({});

            const { service } = buildService({ hashtagModel, postHashtagModel });

            const input: SetPostHashtagsInput = {
                actor: actorWithUpdatePerm,
                postId: POST_ID,
                hashtags: ['#playa'] // only keep #playa
            };

            // Act
            const result = await service.setPostHashtags(input);

            // Assert
            expect(result.error).toBeUndefined();
            expect(postHashtagModel.hardDelete).toHaveBeenCalledWith({ id: LINK_ID_2 });
            expect(postHashtagModel.hardDelete).not.toHaveBeenCalledWith({ id: LINK_ID_1 });
        });
    });

    describe('happy path — reorders existing links', () => {
        it('should update position when order changes', async () => {
            // Arrange
            // The service calls hashtagModel.findOne({ normalizedHashtag }) for each
            // input hashtag in order. Input is ['#verano', '#playa'], so:
            //   first  findOne → resolves '#verano' → returns HASHTAG_ID_VERANO
            //   second findOne → resolves '#playa'  → returns HASHTAG_ID_PLAYA
            const HASHTAG_ID_VERANO = HASHTAG_ID_1;
            const HASHTAG_ID_PLAYA = HASHTAG_ID_2;
            const LINK_VERANO = LINK_ID_1;
            const LINK_PLAYA = LINK_ID_2;

            const hashtagModel = createModelMock();
            hashtagModel.findOne
                .mockResolvedValueOnce(buildHashtagRow(HASHTAG_ID_VERANO, '#verano'))
                .mockResolvedValueOnce(buildHashtagRow(HASHTAG_ID_PLAYA, '#playa'));

            // Current links: verano at position 0, playa at position 1
            // We swap the order → verano stays at 0 (no change), playa stays at 1 (no change).
            // To actually trigger updates we need both to shift:
            // Set current: playa=0, verano=1 → desired ['#verano', '#playa'] → verano→0, playa→1
            const postHashtagModel = createModelMock();
            postHashtagModel.findAll.mockResolvedValue({
                items: [
                    buildLinkRow(LINK_PLAYA, HASHTAG_ID_PLAYA, 0), // playa currently at 0
                    buildLinkRow(LINK_VERANO, HASHTAG_ID_VERANO, 1) // verano currently at 1
                ],
                total: 2
            });
            postHashtagModel.update.mockResolvedValue({});
            postHashtagModel.hardDelete.mockResolvedValue(undefined);

            const { service } = buildService({ hashtagModel, postHashtagModel });

            const input: SetPostHashtagsInput = {
                actor: actorWithUpdatePerm,
                postId: POST_ID,
                hashtags: ['#verano', '#playa'] // desired: verano=0, playa=1
            };

            // Act
            const result = await service.setPostHashtags(input);

            // Assert
            expect(result.error).toBeUndefined();
            // verano link was at position 1, desired position 0 → update
            expect(postHashtagModel.update).toHaveBeenCalledWith(
                { id: LINK_VERANO },
                { position: 0 }
            );
            // playa link was at position 0, desired position 1 → update
            expect(postHashtagModel.update).toHaveBeenCalledWith(
                { id: LINK_PLAYA },
                { position: 1 }
            );
        });
    });

    describe('happy path — regenerates finalHashtagsText', () => {
        it('should persist joined normalized hashtags and return finalHashtagsText', async () => {
            // Arrange
            const hashtagModel = createModelMock();
            hashtagModel.findOne
                .mockResolvedValueOnce(buildHashtagRow(HASHTAG_ID_1, '#playa'))
                .mockResolvedValueOnce(buildHashtagRow(HASHTAG_ID_2, '#verano'))
                .mockResolvedValueOnce(buildHashtagRow(HASHTAG_ID_3, '#turismo'));

            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(buildPostRow());
            postModel.update.mockResolvedValue(
                buildPostRow({ finalHashtagsText: '#playa #verano #turismo' })
            );

            const postHashtagModel = createModelMock();
            postHashtagModel.findAll.mockResolvedValue({ items: [], total: 0 });
            postHashtagModel.create.mockResolvedValue({});

            const { service } = buildService({ postModel, hashtagModel, postHashtagModel });

            const input: SetPostHashtagsInput = {
                actor: actorWithUpdatePerm,
                postId: POST_ID,
                hashtags: ['#playa', '#verano', '#turismo']
            };

            // Act
            const result = await service.setPostHashtags(input);

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.finalHashtagsText).toBe('#playa #verano #turismo');
            expect(postModel.update).toHaveBeenCalledWith(
                { id: POST_ID },
                expect.objectContaining({
                    finalHashtagsText: '#playa #verano #turismo',
                    updatedById: ACTOR_ID
                })
            );
        });
    });

    describe('edge case — deduplicates normalized hashtags', () => {
        it('should keep only the first occurrence of duplicates', async () => {
            // Arrange
            const hashtagModel = createModelMock();
            hashtagModel.findOne.mockResolvedValue(buildHashtagRow(HASHTAG_ID_1, '#playa'));

            const postHashtagModel = createModelMock();
            postHashtagModel.findAll.mockResolvedValue({ items: [], total: 0 });
            postHashtagModel.create.mockResolvedValue({});

            const { service } = buildService({ hashtagModel, postHashtagModel });

            const input: SetPostHashtagsInput = {
                actor: actorWithUpdatePerm,
                postId: POST_ID,
                hashtags: ['#playa', '#PLAYA', 'playa'] // all normalize to #playa
            };

            // Act
            const result = await service.setPostHashtags(input);

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.hashtags).toHaveLength(1);
            expect(result.data?.finalHashtagsText).toBe('#playa');
        });
    });

    describe('edge case — auto-prepends # when missing', () => {
        it('should normalize hashtag without # prefix and resolve correctly', async () => {
            // Arrange
            const hashtagModel = createModelMock();
            hashtagModel.findOne.mockResolvedValue(buildHashtagRow(HASHTAG_ID_1, '#playa'));

            const postHashtagModel = createModelMock();
            postHashtagModel.findAll.mockResolvedValue({ items: [], total: 0 });
            postHashtagModel.create.mockResolvedValue({});

            const { service } = buildService({ hashtagModel, postHashtagModel });

            const input: SetPostHashtagsInput = {
                actor: actorWithUpdatePerm,
                postId: POST_ID,
                hashtags: ['playa'] // no # prefix
            };

            // Act
            const result = await service.setPostHashtags(input);

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.hashtags[0]?.hashtag).toBe('#playa');
        });
    });

    describe('edge case — empty array clears all hashtags', () => {
        it('should hard-delete all existing links and set finalHashtagsText to empty string', async () => {
            // Arrange
            const postHashtagModel = createModelMock();
            postHashtagModel.findAll.mockResolvedValue({
                items: [
                    buildLinkRow(LINK_ID_1, HASHTAG_ID_1, 0),
                    buildLinkRow(LINK_ID_2, HASHTAG_ID_2, 1)
                ],
                total: 2
            });
            postHashtagModel.hardDelete.mockResolvedValue(undefined);

            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(buildPostRow());
            postModel.update.mockResolvedValue(buildPostRow({ finalHashtagsText: '' }));

            const { service } = buildService({ postModel, postHashtagModel });

            const input: SetPostHashtagsInput = {
                actor: actorWithUpdatePerm,
                postId: POST_ID,
                hashtags: []
            };

            // Act
            const result = await service.setPostHashtags(input);

            // Assert
            expect(result.error).toBeUndefined();
            expect(postHashtagModel.hardDelete).toHaveBeenCalledTimes(2);
            expect(result.data?.hashtags).toHaveLength(0);
            expect(result.data?.finalHashtagsText).toBe('');
        });
    });

    describe('audit log', () => {
        it('should emit POST_HASHTAGS_UPDATED with correct metadata', async () => {
            // Arrange
            const hashtagModel = createModelMock();
            hashtagModel.findOne.mockResolvedValue(buildHashtagRow(HASHTAG_ID_1, '#playa'));

            const postHashtagModel = createModelMock();
            postHashtagModel.findAll.mockResolvedValue({ items: [], total: 0 });
            postHashtagModel.create.mockResolvedValue({});

            const auditLog = buildAuditLogMock();
            const { service } = buildService({ hashtagModel, postHashtagModel, auditLog });

            const input: SetPostHashtagsInput = {
                actor: actorWithUpdatePerm,
                postId: POST_ID,
                hashtags: ['#playa']
            };

            // Act
            await service.setPostHashtags(input);

            // Assert
            expect(auditLog.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    actorId: ACTOR_ID,
                    eventType: SocialAuditEvent.POST_HASHTAGS_UPDATED,
                    entityType: 'social_post',
                    entityId: POST_ID,
                    metadata: expect.objectContaining({
                        finalHashtagsText: '#playa',
                        total: 1
                    })
                })
            );
        });
    });
});
