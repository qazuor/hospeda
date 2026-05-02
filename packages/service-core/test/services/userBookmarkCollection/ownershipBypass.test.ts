/**
 * ownershipBypass.test.ts — regression tests for SPEC-098 Fix 2
 *
 * Verifies that an authenticated actor cannot bypass ownership checks in the
 * generic `search` and `count` pipelines by supplying `?userId=<victim-uuid>`.
 *
 * The fix lives in `_executeSearch` and `_executeCount`: if `params.userId`
 * is present, differs from `actor.id`, and the actor lacks
 * `USER_BOOKMARK_COLLECTION_VIEW_ANY`, the call is rejected with FORBIDDEN.
 *
 * Strategy: mock `UserBookmarkCollectionModel.findAll` and `count` so that
 * the DB layer is never actually reached in the attack scenarios — the
 * permission guard fires before any model call.
 *
 * AAA pattern throughout. One behaviour per test.
 */

import { UserBookmarkCollectionModel } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserBookmarkCollectionService } from '../../../src/services/userBookmarkCollection/userBookmarkCollection.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

// ---------------------------------------------------------------------------
// Shared IDs
// ---------------------------------------------------------------------------

const ACTOR_ID = getMockId('user', 'ownership-bypass-actor');
const VICTIM_ID = getMockId('user', 'ownership-bypass-victim');

// ---------------------------------------------------------------------------
// Suite setup
// ---------------------------------------------------------------------------

describe('UserBookmarkCollectionService — ownership bypass prevention (Fix 2)', () => {
    let service: UserBookmarkCollectionService;
    let modelMock: UserBookmarkCollectionModel;

    beforeEach(() => {
        modelMock = createTypedModelMock(UserBookmarkCollectionModel, ['findAll', 'count']);
        const loggerMock = createLoggerMock();
        service = new UserBookmarkCollectionService({ logger: loggerMock }, modelMock);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // search()
    // =========================================================================

    /**
     * Helper: build complete search params with required defaults to satisfy the
     * service's typed signature. The ownership-bypass scenarios only care about
     * the `userId` field; the rest are filled with safe defaults.
     */
    const searchParams = (userId?: string) => ({
        page: 1,
        pageSize: 10,
        includeBookmarkCount: false,
        ...(userId !== undefined ? { userId } : {})
    });

    /**
     * Helper: build complete count params with required defaults.
     */
    const countParams = (userId?: string) => ({
        page: 1,
        pageSize: 10,
        includeBookmarkCount: false,
        ...(userId !== undefined ? { userId } : {})
    });

    describe('search()', () => {
        // -------------------------------------------------------------------
        // TC-OB-1: cross-tenant search attempt without VIEW_ANY → FORBIDDEN
        // -------------------------------------------------------------------
        it('rejects cross-tenant search when actor.id !== params.userId and lacks VIEW_ANY', async () => {
            // Arrange — actor is authenticated but targets a different user
            const actor = createActor({ id: ACTOR_ID, permissions: [] });

            // Act
            const result = await service.search(actor, searchParams(VICTIM_ID));

            // Assert
            expect(result.error?.code).toBe('FORBIDDEN');
            expect(result.error?.message).toContain(
                'Cannot search collections belonging to another user'
            );
            // DB must NOT have been reached
            expect(asMock(modelMock.findAll)).not.toHaveBeenCalled();
        });

        // -------------------------------------------------------------------
        // TC-OB-2: actor with VIEW_ANY can search any user's collections
        // -------------------------------------------------------------------
        it('allows actor with USER_BOOKMARK_COLLECTION_VIEW_ANY to search another user', async () => {
            // Arrange
            const admin = createActor({
                id: ACTOR_ID,
                permissions: [PermissionEnum.USER_BOOKMARK_COLLECTION_VIEW_ANY]
            });
            asMock(modelMock.findAll).mockResolvedValue({ items: [], total: 0 });

            // Act
            const result = await service.search(admin, searchParams(VICTIM_ID));

            // Assert — should reach the model
            expect(result.error).toBeUndefined();
            expect(asMock(modelMock.findAll)).toHaveBeenCalledTimes(1);
        });

        // -------------------------------------------------------------------
        // TC-OB-3: owner can search their own collections
        // -------------------------------------------------------------------
        it('allows actor to search their own collections (userId === actor.id)', async () => {
            // Arrange
            const actor = createActor({ id: ACTOR_ID, permissions: [] });
            asMock(modelMock.findAll).mockResolvedValue({ items: [], total: 0 });

            // Act
            const result = await service.search(actor, searchParams(ACTOR_ID));

            // Assert
            expect(result.error).toBeUndefined();
            expect(asMock(modelMock.findAll)).toHaveBeenCalledTimes(1);
        });

        // -------------------------------------------------------------------
        // TC-OB-4: omitting userId entirely still works (no cross-tenant filter)
        // -------------------------------------------------------------------
        it('allows search without any userId filter (no ownership constraint applies)', async () => {
            // Arrange
            const actor = createActor({ id: ACTOR_ID, permissions: [] });
            asMock(modelMock.findAll).mockResolvedValue({ items: [], total: 0 });

            // Act — no userId provided
            const result = await service.search(actor, searchParams());

            // Assert
            expect(result.error).toBeUndefined();
            expect(asMock(modelMock.findAll)).toHaveBeenCalledTimes(1);
        });
    });

    // =========================================================================
    // count()
    // =========================================================================

    describe('count()', () => {
        // -------------------------------------------------------------------
        // TC-OB-5: cross-tenant count attempt without VIEW_ANY → FORBIDDEN
        // -------------------------------------------------------------------
        it('rejects cross-tenant count when actor.id !== params.userId and lacks VIEW_ANY', async () => {
            // Arrange
            const actor = createActor({ id: ACTOR_ID, permissions: [] });

            // Act
            const result = await service.count(actor, countParams(VICTIM_ID));

            // Assert
            expect(result.error?.code).toBe('FORBIDDEN');
            expect(result.error?.message).toContain(
                'Cannot count collections belonging to another user'
            );
            // DB must NOT have been reached
            expect(asMock(modelMock.count)).not.toHaveBeenCalled();
        });

        // -------------------------------------------------------------------
        // TC-OB-6: actor with VIEW_ANY can count any user's collections
        // -------------------------------------------------------------------
        it('allows actor with USER_BOOKMARK_COLLECTION_VIEW_ANY to count another user', async () => {
            // Arrange
            const admin = createActor({
                id: ACTOR_ID,
                permissions: [PermissionEnum.USER_BOOKMARK_COLLECTION_VIEW_ANY]
            });
            asMock(modelMock.count).mockResolvedValue(5);

            // Act
            const result = await service.count(admin, countParams(VICTIM_ID));

            // Assert
            expect(result.error).toBeUndefined();
            expect(asMock(modelMock.count)).toHaveBeenCalledTimes(1);
        });

        // -------------------------------------------------------------------
        // TC-OB-7: owner can count their own collections
        // -------------------------------------------------------------------
        it('allows actor to count their own collections (userId === actor.id)', async () => {
            // Arrange
            const actor = createActor({ id: ACTOR_ID, permissions: [] });
            asMock(modelMock.count).mockResolvedValue(3);

            // Act
            const result = await service.count(actor, countParams(ACTOR_ID));

            // Assert
            expect(result.error).toBeUndefined();
            expect(asMock(modelMock.count)).toHaveBeenCalledTimes(1);
        });
    });
});
