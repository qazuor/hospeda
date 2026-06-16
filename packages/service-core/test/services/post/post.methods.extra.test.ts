/**
 * @file post.methods.extra.test.ts
 *
 * Supplemental coverage for PostService methods not covered by existing tests:
 * - incrementShare: returns { success: false } stub
 * - addComment: throws NOT_IMPLEMENTED
 * - removeComment: throws NOT_IMPLEMENTED
 * - getMonthlyTrend: permission gate, success path
 */

import { PostModel } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it } from 'vitest';
import { PostService } from '../../../src/services/post/post.service.js';
import { createActor } from '../../factories/actorFactory.js';
import { getMockId } from '../../factories/utilsFactory.js';
import { expectForbiddenError, expectSuccess } from '../../helpers/assertions.js';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory.js';

describe('PostService — extra method coverage', () => {
    let service: PostService;
    let modelMock: PostModel;

    const actor = createActor({ id: getMockId('user') });
    const adminActor = createActor({
        id: getMockId('user', 'admin'),
        role: RoleEnum.SUPER_ADMIN,
        permissions: Object.values(PermissionEnum)
    });

    beforeEach(() => {
        modelMock = createTypedModelMock(PostModel, ['findOne', 'getMonthlyTrend']);
        service = new PostService({ logger: createLoggerMock() }, modelMock);
    });

    // =========================================================================
    // incrementShare
    // =========================================================================

    describe('incrementShare', () => {
        it('should return { success: false } (stub behaviour)', async () => {
            // Act — incrementShare is a stub that always returns false
            const result = await service.incrementShare(actor, getMockId('post'));

            // Assert
            expectSuccess(result);
            expect(result.data?.success).toBe(false);
        });
    });

    // =========================================================================
    // addComment
    // =========================================================================

    describe('addComment', () => {
        it('should return NOT_IMPLEMENTED error for an authenticated user', async () => {
            // Arrange — any actor with an id can attempt to comment
            const postId = getMockId('post');

            // Act
            const result = await service.addComment(actor, {
                postId,
                comment: 'Great post!'
            });

            // Assert
            expect(result.error?.code).toBe('NOT_IMPLEMENTED');
        });

        it('should return an error when actor has no id (unauthenticated)', async () => {
            // Arrange — guest actor with no id
            const guestActor = createActor({ id: '', role: RoleEnum.GUEST, permissions: [] });
            const postId = getMockId('post');

            // Act
            const result = await service.addComment(guestActor, {
                postId,
                comment: 'Will not work'
            });

            // Assert — base service may return UNAUTHORIZED or FORBIDDEN for an actor with no id
            expect(result.error?.code).toMatch(/UNAUTHORIZED|FORBIDDEN/);
        });
    });

    // =========================================================================
    // removeComment
    // =========================================================================

    describe('removeComment', () => {
        it('should return NOT_IMPLEMENTED error for an authenticated user', async () => {
            // Arrange — any actor with an id
            const postId = getMockId('post');
            // 'comment' is not in IdTypes; use a hardcoded valid UUID instead
            const commentId = 'a1b2c3d4-1234-4abc-8def-000000000001';

            // Act
            const result = await service.removeComment(actor, {
                postId,
                commentId
            });

            // Assert
            expect(result.error?.code).toBe('NOT_IMPLEMENTED');
        });
    });

    // =========================================================================
    // getMonthlyTrend
    // =========================================================================

    describe('getMonthlyTrend', () => {
        it('should return FORBIDDEN when actor lacks POST_VIEW_ALL permission', async () => {
            // Act
            const result = await service.getMonthlyTrend(actor);

            // Assert
            expectForbiddenError(result);
        });

        it('should return monthly trend data when actor has POST_VIEW_ALL', async () => {
            // Arrange
            const trendData = [
                { month: '2026-01', count: 12 },
                { month: '2026-02', count: 8 }
            ];
            (modelMock.getMonthlyTrend as Mock).mockResolvedValue(trendData);

            // Act
            const result = await service.getMonthlyTrend(adminActor);

            // Assert
            expectSuccess(result);
            expect(result.data).toEqual(trendData);
            expect(modelMock.getMonthlyTrend).toHaveBeenCalledOnce();
        });

        it('should return empty array when no trend data exists', async () => {
            // Arrange
            (modelMock.getMonthlyTrend as Mock).mockResolvedValue([]);

            // Act
            const result = await service.getMonthlyTrend(adminActor);

            // Assert
            expectSuccess(result);
            expect(result.data).toEqual([]);
        });
    });
});
