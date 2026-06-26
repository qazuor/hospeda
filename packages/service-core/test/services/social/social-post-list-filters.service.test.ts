/**
 * Unit tests for SocialPostService.listPosts — campaignId and batchId filters.
 *
 * Covers:
 * - FORBIDDEN when actor lacks SOCIAL_POST_VIEW
 * - filter by campaignId: only posts with that campaignId are returned
 * - filter by batchId: only posts with that batchId are returned
 * - filter by both campaignId and batchId simultaneously
 * - no filter: all non-deleted posts are returned
 *
 * SPEC-254 batch/campaign filter addition.
 */

import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SocialAuditLogService } from '../../../src/services/social/social-audit-log.service';
import { SocialPostService } from '../../../src/services/social/social-post.service';
import type { Actor } from '../../../src/types';
import { createModelMock } from '../../utils/modelMockFactory';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTOR_ID = '00000000-0000-4000-8000-000000000020';
const POST_ID_1 = '00000000-0000-4000-8000-000000000021';
const POST_ID_2 = '00000000-0000-4000-8000-000000000022';
const CAMPAIGN_ID = '00000000-0000-4000-8000-000000000031';
const BATCH_ID = '00000000-0000-4000-8000-000000000032';

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
// Post fixture builder
// ---------------------------------------------------------------------------

function buildPost(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: POST_ID_1,
        title: 'Test Post',
        status: 'DRAFT',
        approvalStatus: 'PENDING',
        paused: false,
        campaignId: null,
        batchId: null,
        deletedAt: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('SocialPostService.listPosts — campaignId and batchId filters', () => {
    let postModelMock: ReturnType<typeof createModelMock>;
    let targetModelMock: ReturnType<typeof createModelMock>;
    let mediaModelMock: ReturnType<typeof createModelMock>;
    let assetModelMock: ReturnType<typeof createModelMock>;
    let auditLogMock: SocialAuditLogService;
    let service: SocialPostService;

    beforeEach(() => {
        vi.clearAllMocks();

        postModelMock = createModelMock();
        targetModelMock = createModelMock();
        mediaModelMock = createModelMock();
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
            assetModelMock as never
        );

        // Default: target and media return empty so enrichment is a no-op
        targetModelMock.findAll.mockResolvedValue({ items: [], total: 0 });
        mediaModelMock.findAll.mockResolvedValue({ items: [], total: 0 });
        assetModelMock.findOne.mockResolvedValue(null);
    });

    // -----------------------------------------------------------------------
    // FORBIDDEN
    // -----------------------------------------------------------------------

    describe('FORBIDDEN', () => {
        it('returns FORBIDDEN error when actor lacks SOCIAL_POST_VIEW', async () => {
            // Arrange
            const actor = buildActor(false);
            postModelMock.findAll.mockResolvedValue({ items: [], total: 0 });

            // Act
            const result = await service.listPosts({ actor });

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(result.data).toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // No filter — baseline
    // -----------------------------------------------------------------------

    describe('no filters', () => {
        it('passes deletedAt=null to the model and returns all non-deleted posts', async () => {
            // Arrange
            const actor = buildActor(true);
            const post = buildPost();
            postModelMock.findAll.mockResolvedValue({ items: [post], total: 1 });

            // Act
            const result = await service.listPosts({ actor, filters: {} });

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.items).toHaveLength(1);
            expect(result.data?.total).toBe(1);

            const whereArg = postModelMock.findAll.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(whereArg).toMatchObject({ deletedAt: null });
            expect(whereArg.campaignId).toBeUndefined();
            expect(whereArg.batchId).toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // Filter by campaignId
    // -----------------------------------------------------------------------

    describe('filter by campaignId', () => {
        it('passes campaignId to the model where clause', async () => {
            // Arrange
            const actor = buildActor(true);
            const post = buildPost({ campaignId: CAMPAIGN_ID });
            postModelMock.findAll.mockResolvedValue({ items: [post], total: 1 });

            // Act
            const result = await service.listPosts({
                actor,
                filters: { campaignId: CAMPAIGN_ID }
            });

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.items).toHaveLength(1);

            const whereArg = postModelMock.findAll.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(whereArg.campaignId).toBe(CAMPAIGN_ID);
        });

        it('returns empty list when no posts match the given campaignId', async () => {
            // Arrange
            const actor = buildActor(true);
            postModelMock.findAll.mockResolvedValue({ items: [], total: 0 });

            // Act
            const result = await service.listPosts({
                actor,
                filters: { campaignId: CAMPAIGN_ID }
            });

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.items).toHaveLength(0);
            expect(result.data?.total).toBe(0);
        });

        it('does not include campaignId in where clause when filter is omitted', async () => {
            // Arrange
            const actor = buildActor(true);
            postModelMock.findAll.mockResolvedValue({ items: [], total: 0 });

            // Act
            await service.listPosts({ actor, filters: {} });

            // Assert
            const whereArg = postModelMock.findAll.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(whereArg.campaignId).toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // Filter by batchId
    // -----------------------------------------------------------------------

    describe('filter by batchId', () => {
        it('passes batchId to the model where clause', async () => {
            // Arrange
            const actor = buildActor(true);
            const post = buildPost({ batchId: BATCH_ID });
            postModelMock.findAll.mockResolvedValue({ items: [post], total: 1 });

            // Act
            const result = await service.listPosts({
                actor,
                filters: { batchId: BATCH_ID }
            });

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.items).toHaveLength(1);

            const whereArg = postModelMock.findAll.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(whereArg.batchId).toBe(BATCH_ID);
        });

        it('returns empty list when no posts match the given batchId', async () => {
            // Arrange
            const actor = buildActor(true);
            postModelMock.findAll.mockResolvedValue({ items: [], total: 0 });

            // Act
            const result = await service.listPosts({
                actor,
                filters: { batchId: BATCH_ID }
            });

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.items).toHaveLength(0);
            expect(result.data?.total).toBe(0);
        });

        it('does not include batchId in where clause when filter is omitted', async () => {
            // Arrange
            const actor = buildActor(true);
            postModelMock.findAll.mockResolvedValue({ items: [], total: 0 });

            // Act
            await service.listPosts({ actor, filters: {} });

            // Assert
            const whereArg = postModelMock.findAll.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(whereArg.batchId).toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // Combined campaignId + batchId
    // -----------------------------------------------------------------------

    describe('combined campaignId and batchId filters', () => {
        it('passes both campaignId and batchId to the where clause when both are provided', async () => {
            // Arrange
            const actor = buildActor(true);
            const post = buildPost({ campaignId: CAMPAIGN_ID, batchId: BATCH_ID });
            postModelMock.findAll.mockResolvedValue({ items: [post], total: 1 });

            // Act
            const result = await service.listPosts({
                actor,
                filters: { campaignId: CAMPAIGN_ID, batchId: BATCH_ID }
            });

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.items).toHaveLength(1);

            const whereArg = postModelMock.findAll.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(whereArg.campaignId).toBe(CAMPAIGN_ID);
            expect(whereArg.batchId).toBe(BATCH_ID);
        });

        it('returns multiple enriched items when multiple posts match', async () => {
            // Arrange
            const actor = buildActor(true);
            const post1 = buildPost({ id: POST_ID_1, campaignId: CAMPAIGN_ID, batchId: BATCH_ID });
            const post2 = buildPost({ id: POST_ID_2, campaignId: CAMPAIGN_ID, batchId: BATCH_ID });
            postModelMock.findAll.mockResolvedValue({ items: [post1, post2], total: 2 });

            // Act
            const result = await service.listPosts({
                actor,
                filters: { campaignId: CAMPAIGN_ID, batchId: BATCH_ID }
            });

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.items).toHaveLength(2);
            expect(result.data?.total).toBe(2);
        });
    });
});
