/**
 * Unit tests for SocialPublishLogService.list — SPEC-254 T-037.
 *
 * Covers:
 * - FORBIDDEN when actor lacks SOCIAL_PUBLISH_LOG_VIEW
 * - Happy path: returns items + total from model
 * - Equality filters: postId→socialPostId, targetId→socialPostTargetId, status, platform
 * - Pagination defaults: page=1, pageSize=20
 * - pageSize capped at 100
 * - sortBy=createdAt, sortOrder=desc always passed
 *
 * SPEC-254 T-037.
 */

import type { SocialPublishLogModel } from '@repo/db';
import {
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    SocialPublishResultStatusEnum
} from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type ListPublishLogsInput,
    SocialPublishLogService
} from '../../../src/services/social/social-publish-log.service';
import type { Actor } from '../../../src/types';
import { createModelMock } from '../../utils/modelMockFactory';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTOR_ID = '00000000-0000-4000-8000-000000000010';
const POST_ID = '00000000-0000-4000-8000-000000000020';
const TARGET_ID = '00000000-0000-4000-8000-000000000030';

// ---------------------------------------------------------------------------
// Actor fixtures
// ---------------------------------------------------------------------------

function buildActor(hasView: boolean): Actor {
    return {
        id: ACTOR_ID,
        role: RoleEnum.ADMIN,
        permissions: hasView ? [PermissionEnum.SOCIAL_PUBLISH_LOG_VIEW] : []
    };
}

// ---------------------------------------------------------------------------
// Helper to build minimal input
// ---------------------------------------------------------------------------

function buildInput(overrides: Partial<ListPublishLogsInput> = {}): ListPublishLogsInput {
    return {
        actor: buildActor(true),
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('SocialPublishLogService.list — SPEC-254 T-037', () => {
    let modelMock: ReturnType<typeof createModelMock>;
    let service: SocialPublishLogService;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createModelMock();
        service = new SocialPublishLogService(
            { logger: undefined },
            modelMock as unknown as SocialPublishLogModel
        );
        // Default: return empty list
        modelMock.findAll.mockResolvedValue({ items: [], total: 0 });
    });

    // -------------------------------------------------------------------------
    // FORBIDDEN
    // -------------------------------------------------------------------------

    describe('FORBIDDEN', () => {
        it('returns FORBIDDEN when actor lacks SOCIAL_PUBLISH_LOG_VIEW', async () => {
            // Arrange
            const input = buildInput({ actor: buildActor(false) });

            // Act
            const result = await service.list(input);

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(result.data).toBeUndefined();
            expect(modelMock.findAll).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // Happy path
    // -------------------------------------------------------------------------

    describe('happy path', () => {
        it('returns data with items and total from the model', async () => {
            // Arrange
            const fakeItems = [{ id: '1', status: SocialPublishResultStatusEnum.SUCCESS }];
            modelMock.findAll.mockResolvedValue({ items: fakeItems, total: 1 });

            // Act
            const result = await service.list(buildInput());

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.items).toHaveLength(1);
            expect(result.data?.total).toBe(1);
        });

        it('calls model.findAll with sortBy=createdAt and sortOrder=desc', async () => {
            // Arrange / Act
            await service.list(buildInput());

            // Assert
            const [, opts] = modelMock.findAll.mock.calls[0] ?? [];
            expect(opts.sortBy).toBe('createdAt');
            expect(opts.sortOrder).toBe('desc');
        });
    });

    // -------------------------------------------------------------------------
    // Pagination
    // -------------------------------------------------------------------------

    describe('pagination', () => {
        it('defaults to page=1 and pageSize=20 when not provided', async () => {
            // Arrange / Act
            await service.list(buildInput({ filters: {} }));

            // Assert
            const [, opts] = modelMock.findAll.mock.calls[0] ?? [];
            expect(opts.page).toBe(1);
            expect(opts.pageSize).toBe(20);
        });

        it('caps pageSize at 100 even if caller passes a larger value', async () => {
            // Arrange / Act
            await service.list(buildInput({ filters: { pageSize: 500 } }));

            // Assert
            const [, opts] = modelMock.findAll.mock.calls[0] ?? [];
            expect(opts.pageSize).toBe(100);
        });

        it('passes explicit page and pageSize through unchanged (within limits)', async () => {
            // Arrange / Act
            await service.list(buildInput({ filters: { page: 2, pageSize: 50 } }));

            // Assert
            const [, opts] = modelMock.findAll.mock.calls[0] ?? [];
            expect(opts.page).toBe(2);
            expect(opts.pageSize).toBe(50);
        });
    });

    // -------------------------------------------------------------------------
    // Equality filters — DB column mapping
    // -------------------------------------------------------------------------

    describe('equality filters and DB column mapping', () => {
        it('maps filters.postId to where.socialPostId', async () => {
            // Arrange / Act
            await service.list(buildInput({ filters: { postId: POST_ID } }));

            // Assert
            const [where] = modelMock.findAll.mock.calls[0] ?? [];
            expect(where.socialPostId).toBe(POST_ID);
            expect(where.postId).toBeUndefined();
        });

        it('maps filters.targetId to where.socialPostTargetId', async () => {
            // Arrange / Act
            await service.list(buildInput({ filters: { targetId: TARGET_ID } }));

            // Assert
            const [where] = modelMock.findAll.mock.calls[0] ?? [];
            expect(where.socialPostTargetId).toBe(TARGET_ID);
            expect(where.targetId).toBeUndefined();
        });

        it('forwards status directly to the where clause', async () => {
            // Arrange / Act
            await service.list(
                buildInput({
                    filters: { status: SocialPublishResultStatusEnum.FAILED }
                })
            );

            // Assert
            const [where] = modelMock.findAll.mock.calls[0] ?? [];
            expect(where.status).toBe(SocialPublishResultStatusEnum.FAILED);
        });

        it('forwards platform directly to the where clause', async () => {
            // Arrange / Act
            await service.list(buildInput({ filters: { platform: 'INSTAGRAM' } }));

            // Assert
            const [where] = modelMock.findAll.mock.calls[0] ?? [];
            expect(where.platform).toBe('INSTAGRAM');
        });

        it('does not include empty keys in where when no filters passed', async () => {
            // Arrange / Act
            await service.list(buildInput({ filters: {} }));

            // Assert
            const [where] = modelMock.findAll.mock.calls[0] ?? [];
            expect(Object.keys(where)).toHaveLength(0);
        });

        it('combines multiple filters in the same where call', async () => {
            // Arrange / Act
            await service.list(
                buildInput({
                    filters: {
                        postId: POST_ID,
                        status: SocialPublishResultStatusEnum.SUCCESS,
                        platform: 'FACEBOOK'
                    }
                })
            );

            // Assert
            const [where] = modelMock.findAll.mock.calls[0] ?? [];
            expect(where.socialPostId).toBe(POST_ID);
            expect(where.status).toBe(SocialPublishResultStatusEnum.SUCCESS);
            expect(where.platform).toBe('FACEBOOK');
        });
    });
});
