/**
 * Unit tests for SocialPostService.getDashboard — SPEC-254 T-037.
 *
 * Covers:
 * - FORBIDDEN when actor lacks SOCIAL_POST_VIEW
 * - KPI counts: totalPosts, pendingReview, scheduled, publishedLast30Days (de-duped), failedActionNeeded
 * - quickApprovalQueue: limited to 10, sorted asc, each item has platforms + thumbnailUrl
 * - recentFailures: sourced from social_post_targets with FAILED status; postTitle resolved
 * - makeWebhookConfigured: true when setting value is a non-empty string
 * - makeWebhookConfigured: false when setting is missing
 * - makeWebhookConfigured: false when setting value is empty/whitespace string
 *
 * SPEC-254 T-037.
 */

import {
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    SocialApprovalStatusEnum,
    SocialPostStatusEnum,
    SocialPublishResultStatusEnum
} from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SocialAuditLogService } from '../../../src/services/social/social-audit-log.service';
import { SocialPostService } from '../../../src/services/social/social-post.service';
import type { Actor } from '../../../src/types';
import { createModelMock } from '../../utils/modelMockFactory';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTOR_ID = '00000000-0000-4000-8000-000000000010';
const POST_ID_1 = '00000000-0000-4000-8000-000000000011';
const POST_ID_2 = '00000000-0000-4000-8000-000000000012';
const TARGET_ID_1 = '00000000-0000-4000-8000-000000000013';

// ---------------------------------------------------------------------------
// Actor fixtures
// ---------------------------------------------------------------------------

function buildActor(hasView: boolean): Actor {
    return {
        id: ACTOR_ID,
        role: RoleEnum.ADMIN,
        permissions: hasView ? [PermissionEnum.SOCIAL_POST_VIEW] : []
    };
}

// ---------------------------------------------------------------------------
// Default empty model responses
// ---------------------------------------------------------------------------

const EMPTY_LIST = { items: [], total: 0 };

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('SocialPostService.getDashboard — SPEC-254 T-037', () => {
    let postModelMock: ReturnType<typeof createModelMock>;
    let targetModelMock: ReturnType<typeof createModelMock>;
    let mediaModelMock: ReturnType<typeof createModelMock>;
    let publishLogModelMock: ReturnType<typeof createModelMock>;
    let settingModelMock: ReturnType<typeof createModelMock>;
    let assetModelMock: ReturnType<typeof createModelMock>;
    let auditLogMock: SocialAuditLogService;
    let service: SocialPostService;

    beforeEach(() => {
        vi.clearAllMocks();
        postModelMock = createModelMock();
        targetModelMock = createModelMock();
        mediaModelMock = createModelMock();
        publishLogModelMock = createModelMock();
        settingModelMock = createModelMock();
        assetModelMock = createModelMock();

        auditLogMock = {
            log: vi.fn().mockResolvedValue({ logged: true }),
            list: vi.fn()
        } as unknown as SocialAuditLogService;

        service = new SocialPostService(
            { logger: undefined },
            postModelMock as never,
            targetModelMock as never,
            mediaModelMock as never,
            undefined,
            auditLogMock,
            undefined,
            undefined,
            assetModelMock as never,
            publishLogModelMock as never,
            settingModelMock as never
        );

        // Defaults: all model calls return empty lists / null
        postModelMock.findAll.mockResolvedValue(EMPTY_LIST);
        postModelMock.findOne.mockResolvedValue(null);
        targetModelMock.findAll.mockResolvedValue(EMPTY_LIST);
        mediaModelMock.findAll.mockResolvedValue(EMPTY_LIST);
        publishLogModelMock.findAll.mockResolvedValue(EMPTY_LIST);
        settingModelMock.findOne.mockResolvedValue(null);
        assetModelMock.findOne.mockResolvedValue(null);
    });

    // -------------------------------------------------------------------------
    // FORBIDDEN
    // -------------------------------------------------------------------------

    describe('FORBIDDEN', () => {
        it('returns FORBIDDEN error when actor lacks SOCIAL_POST_VIEW', async () => {
            // Arrange
            const actor = buildActor(false);

            // Act
            const result = await service.getDashboard({ actor });

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(result.data).toBeUndefined();
        });
    });

    // -------------------------------------------------------------------------
    // KPI: totalPosts
    // -------------------------------------------------------------------------

    describe('KPI: totalPosts', () => {
        it('returns the total from the non-deleted posts query', async () => {
            // Arrange
            const actor = buildActor(true);
            postModelMock.findAll.mockImplementation((where: Record<string, unknown>) => {
                if (where.deletedAt === null && !where.status && !where.approvalStatus) {
                    return Promise.resolve({ items: [], total: 42 });
                }
                return Promise.resolve(EMPTY_LIST);
            });

            // Act
            const result = await service.getDashboard({ actor });

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.kpis.totalPosts).toBe(42);
        });
    });

    // -------------------------------------------------------------------------
    // KPI: pendingReview
    // -------------------------------------------------------------------------

    describe('KPI: pendingReview', () => {
        it('counts posts in NEEDS_REVIEW + PENDING approval (without sort opts)', async () => {
            // Arrange
            const actor = buildActor(true);
            postModelMock.findAll.mockImplementation(
                (where: Record<string, unknown>, opts?: Record<string, unknown>) => {
                    if (
                        where.status === SocialPostStatusEnum.NEEDS_REVIEW &&
                        where.approvalStatus === SocialApprovalStatusEnum.PENDING &&
                        !opts?.sortOrder
                    ) {
                        return Promise.resolve({ items: [], total: 7 });
                    }
                    return Promise.resolve(EMPTY_LIST);
                }
            );

            // Act
            const result = await service.getDashboard({ actor });

            // Assert
            expect(result.data?.kpis.pendingReview).toBe(7);
        });
    });

    // -------------------------------------------------------------------------
    // KPI: scheduled
    // -------------------------------------------------------------------------

    describe('KPI: scheduled', () => {
        it('counts posts in SCHEDULED status', async () => {
            // Arrange
            const actor = buildActor(true);
            postModelMock.findAll.mockImplementation((where: Record<string, unknown>) => {
                if (where.status === SocialPostStatusEnum.SCHEDULED) {
                    return Promise.resolve({ items: [], total: 3 });
                }
                return Promise.resolve(EMPTY_LIST);
            });

            // Act
            const result = await service.getDashboard({ actor });

            // Assert
            expect(result.data?.kpis.scheduled).toBe(3);
        });
    });

    // -------------------------------------------------------------------------
    // KPI: publishedLast30Days (de-duplication by socialPostId)
    // -------------------------------------------------------------------------

    describe('KPI: publishedLast30Days', () => {
        it('de-dupes SUCCESS log rows with the same socialPostId (2 rows → count 1)', async () => {
            // Arrange
            const actor = buildActor(true);
            publishLogModelMock.findAll.mockResolvedValue({
                items: [
                    { socialPostId: POST_ID_1, status: SocialPublishResultStatusEnum.SUCCESS },
                    { socialPostId: POST_ID_1, status: SocialPublishResultStatusEnum.SUCCESS }
                ],
                total: 2
            });

            // Act
            const result = await service.getDashboard({ actor });

            // Assert
            expect(result.data?.kpis.publishedLast30Days).toBe(1);
        });

        it('counts multiple distinct socialPostIds independently', async () => {
            // Arrange
            const actor = buildActor(true);
            publishLogModelMock.findAll.mockResolvedValue({
                items: [
                    { socialPostId: POST_ID_1, status: SocialPublishResultStatusEnum.SUCCESS },
                    { socialPostId: POST_ID_2, status: SocialPublishResultStatusEnum.SUCCESS }
                ],
                total: 2
            });

            // Act
            const result = await service.getDashboard({ actor });

            // Assert
            expect(result.data?.kpis.publishedLast30Days).toBe(2);
        });

        it('returns 0 when no success logs exist in the last 30 days', async () => {
            // Arrange
            const actor = buildActor(true);
            publishLogModelMock.findAll.mockResolvedValue(EMPTY_LIST);

            // Act
            const result = await service.getDashboard({ actor });

            // Assert
            expect(result.data?.kpis.publishedLast30Days).toBe(0);
        });
    });

    // -------------------------------------------------------------------------
    // KPI: failedActionNeeded
    // -------------------------------------------------------------------------

    describe('KPI: failedActionNeeded', () => {
        it('counts posts in FAILED status', async () => {
            // Arrange
            const actor = buildActor(true);
            postModelMock.findAll.mockImplementation((where: Record<string, unknown>) => {
                if (where.status === SocialPostStatusEnum.FAILED) {
                    return Promise.resolve({ items: [], total: 5 });
                }
                return Promise.resolve(EMPTY_LIST);
            });

            // Act
            const result = await service.getDashboard({ actor });

            // Assert
            expect(result.data?.kpis.failedActionNeeded).toBe(5);
        });
    });

    // -------------------------------------------------------------------------
    // quickApprovalQueue
    // -------------------------------------------------------------------------

    describe('quickApprovalQueue', () => {
        it('enriches queue items with platforms from their target rows', async () => {
            // Arrange
            const actor = buildActor(true);
            const reviewPost = {
                id: POST_ID_1,
                title: 'Test Post',
                status: SocialPostStatusEnum.NEEDS_REVIEW,
                approvalStatus: SocialApprovalStatusEnum.PENDING,
                createdAt: new Date('2025-01-01')
            };
            postModelMock.findAll.mockImplementation(
                (where: Record<string, unknown>, opts?: Record<string, unknown>) => {
                    if (
                        where.status === SocialPostStatusEnum.NEEDS_REVIEW &&
                        opts?.sortOrder === 'asc'
                    ) {
                        return Promise.resolve({ items: [reviewPost], total: 1 });
                    }
                    return Promise.resolve(EMPTY_LIST);
                }
            );
            targetModelMock.findAll.mockImplementation((where: Record<string, unknown>) => {
                if (where.socialPostId === POST_ID_1) {
                    return Promise.resolve({
                        items: [{ platform: 'INSTAGRAM', socialPostId: POST_ID_1 }],
                        total: 1
                    });
                }
                return Promise.resolve(EMPTY_LIST);
            });

            // Act
            const result = await service.getDashboard({ actor });

            // Assert
            expect(result.data?.quickApprovalQueue).toHaveLength(1);
            const item = result.data?.quickApprovalQueue[0];
            expect(item?.id).toBe(POST_ID_1);
            expect(item?.title).toBe('Test Post');
            expect(item?.platforms).toContain('INSTAGRAM');
            expect(item?.thumbnailUrl).toBeNull();
        });

        it('resolves thumbnailUrl from the first media row asset cloudinaryUrl', async () => {
            // Arrange
            const actor = buildActor(true);
            const ASSET_ID = '00000000-0000-4000-8000-000000000099';
            const reviewPost = {
                id: POST_ID_1,
                title: 'Photo Post',
                status: SocialPostStatusEnum.NEEDS_REVIEW,
                approvalStatus: SocialApprovalStatusEnum.PENDING,
                createdAt: new Date('2025-01-01')
            };
            postModelMock.findAll.mockImplementation(
                (where: Record<string, unknown>, opts?: Record<string, unknown>) => {
                    if (
                        where.status === SocialPostStatusEnum.NEEDS_REVIEW &&
                        opts?.sortOrder === 'asc'
                    ) {
                        return Promise.resolve({ items: [reviewPost], total: 1 });
                    }
                    return Promise.resolve(EMPTY_LIST);
                }
            );
            mediaModelMock.findAll.mockResolvedValue({
                items: [{ assetId: ASSET_ID, socialPostId: POST_ID_1, position: 0 }],
                total: 1
            });
            assetModelMock.findOne.mockResolvedValue({
                id: ASSET_ID,
                cloudinaryUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg'
            });

            // Act
            const result = await service.getDashboard({ actor });

            // Assert
            expect(result.data?.quickApprovalQueue[0].thumbnailUrl).toBe(
                'https://res.cloudinary.com/demo/image/upload/sample.jpg'
            );
        });
    });

    // -------------------------------------------------------------------------
    // recentFailures
    // -------------------------------------------------------------------------

    describe('recentFailures', () => {
        it('resolves postTitle for each failed target via postModel.findOne', async () => {
            // Arrange
            const actor = buildActor(true);
            const failedTarget = {
                id: TARGET_ID_1,
                socialPostId: POST_ID_1,
                platform: 'FACEBOOK',
                lastErrorMessage: 'timeout',
                retryCount: 3,
                updatedAt: new Date('2025-06-01'),
                status: SocialPostStatusEnum.FAILED
            };
            targetModelMock.findAll.mockImplementation(
                (where: Record<string, unknown>, opts?: Record<string, unknown>) => {
                    if (
                        where.status === SocialPostStatusEnum.FAILED &&
                        opts?.sortOrder === 'desc'
                    ) {
                        return Promise.resolve({ items: [failedTarget], total: 1 });
                    }
                    return Promise.resolve(EMPTY_LIST);
                }
            );
            postModelMock.findOne.mockResolvedValue({ id: POST_ID_1, title: 'My Post' });

            // Act
            const result = await service.getDashboard({ actor });

            // Assert
            expect(result.data?.recentFailures).toHaveLength(1);
            const failure = result.data?.recentFailures[0];
            expect(failure?.targetId).toBe(TARGET_ID_1);
            expect(failure?.postTitle).toBe('My Post');
            expect(failure?.platform).toBe('FACEBOOK');
            expect(failure?.lastError).toBe('timeout');
            expect(failure?.retryCount).toBe(3);
        });

        it('falls back to "Unknown" postTitle when post lookup returns null', async () => {
            // Arrange
            const actor = buildActor(true);
            targetModelMock.findAll.mockImplementation(
                (where: Record<string, unknown>, opts?: Record<string, unknown>) => {
                    if (
                        where.status === SocialPostStatusEnum.FAILED &&
                        opts?.sortOrder === 'desc'
                    ) {
                        return Promise.resolve({
                            items: [
                                {
                                    id: TARGET_ID_1,
                                    socialPostId: POST_ID_1,
                                    platform: 'INSTAGRAM',
                                    lastErrorMessage: null,
                                    retryCount: 0,
                                    updatedAt: new Date()
                                }
                            ],
                            total: 1
                        });
                    }
                    return Promise.resolve(EMPTY_LIST);
                }
            );
            postModelMock.findOne.mockResolvedValue(null);

            // Act
            const result = await service.getDashboard({ actor });

            // Assert
            expect(result.data?.recentFailures[0].postTitle).toBe('Unknown');
        });

        it('maps null lastErrorMessage to null on the failure item', async () => {
            // Arrange
            const actor = buildActor(true);
            targetModelMock.findAll.mockImplementation(
                (where: Record<string, unknown>, opts?: Record<string, unknown>) => {
                    if (
                        where.status === SocialPostStatusEnum.FAILED &&
                        opts?.sortOrder === 'desc'
                    ) {
                        return Promise.resolve({
                            items: [
                                {
                                    id: TARGET_ID_1,
                                    socialPostId: POST_ID_1,
                                    platform: 'X',
                                    lastErrorMessage: null,
                                    retryCount: 0,
                                    updatedAt: new Date()
                                }
                            ],
                            total: 1
                        });
                    }
                    return Promise.resolve(EMPTY_LIST);
                }
            );

            // Act
            const result = await service.getDashboard({ actor });

            // Assert
            expect(result.data?.recentFailures[0].lastError).toBeNull();
        });
    });

    // -------------------------------------------------------------------------
    // makeWebhookConfigured
    // -------------------------------------------------------------------------

    describe('makeWebhookConfigured', () => {
        it('returns true when make_webhook_url has a valid non-empty value', async () => {
            // Arrange
            const actor = buildActor(true);
            settingModelMock.findOne.mockResolvedValue({
                key: 'make_webhook_url',
                value: 'https://hook.make.com/xyz'
            });

            // Act
            const result = await service.getDashboard({ actor });

            // Assert
            expect(result.data?.makeWebhookConfigured).toBe(true);
        });

        it('returns false when make_webhook_url setting row is absent (null)', async () => {
            // Arrange
            const actor = buildActor(true);
            settingModelMock.findOne.mockResolvedValue(null);

            // Act
            const result = await service.getDashboard({ actor });

            // Assert
            expect(result.data?.makeWebhookConfigured).toBe(false);
        });

        it('returns false when make_webhook_url value is whitespace-only', async () => {
            // Arrange
            const actor = buildActor(true);
            settingModelMock.findOne.mockResolvedValue({ key: 'make_webhook_url', value: '   ' });

            // Act
            const result = await service.getDashboard({ actor });

            // Assert
            expect(result.data?.makeWebhookConfigured).toBe(false);
        });

        it('returns false when make_webhook_url value is an empty string', async () => {
            // Arrange
            const actor = buildActor(true);
            settingModelMock.findOne.mockResolvedValue({ key: 'make_webhook_url', value: '' });

            // Act
            const result = await service.getDashboard({ actor });

            // Assert
            expect(result.data?.makeWebhookConfigured).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // Response shape
    // -------------------------------------------------------------------------

    describe('response shape', () => {
        it('returns all top-level keys with correct types', async () => {
            // Arrange
            const actor = buildActor(true);

            // Act
            const result = await service.getDashboard({ actor });

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data).toMatchObject({
                kpis: expect.objectContaining({
                    totalPosts: expect.any(Number),
                    pendingReview: expect.any(Number),
                    scheduled: expect.any(Number),
                    publishedLast30Days: expect.any(Number),
                    failedActionNeeded: expect.any(Number)
                }),
                quickApprovalQueue: expect.any(Array),
                recentFailures: expect.any(Array),
                makeWebhookConfigured: expect.any(Boolean)
            });
        });
    });
});
