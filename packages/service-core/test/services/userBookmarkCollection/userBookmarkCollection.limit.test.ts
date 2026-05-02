/**
 * userBookmarkCollection.limit.test.ts
 *
 * Unit tests for the per-user collection quota guard implemented in
 * `UserBookmarkCollectionService._canCreate`.
 *
 * Strategy: call the public `service.create()` (which internally invokes
 * `_canCreate`) with a mocked `UserBookmarkCollectionModel` whose
 * `countActiveByUserId` is controlled per test.
 *
 * `getMaxCollectionsPerUser` reads `process.env.HOSPEDA_MAX_COLLECTIONS_PER_USER`
 * at call time — vi.stubEnv() therefore takes effect without module re-import.
 *
 * AAA pattern is used throughout. Each test asserts ONE behaviour.
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
// Shared helpers
// ---------------------------------------------------------------------------

/** A valid UUID to use as the actor / owner id throughout all tests. */
const OWNER_ID = getMockId('user', 'collection-limit-owner');

/**
 * Builds the minimal create input that passes schema validation.
 * `userId` must match actor.id (enforced by `canCreateCollection`).
 */
function makeCreateInput(userId: string = OWNER_ID) {
    return {
        userId,
        name: 'My Wishlist'
    } as const;
}

/**
 * Returns an actor that carries the CREATE permission AND has the given id.
 */
function makeOwnerActor(id: string = OWNER_ID) {
    return createActor({
        id,
        permissions: [PermissionEnum.USER_BOOKMARK_COLLECTION_CREATE]
    });
}

// ---------------------------------------------------------------------------
// Suite setup
// ---------------------------------------------------------------------------

describe('UserBookmarkCollectionService._canCreate — collection limit guard', () => {
    let service: UserBookmarkCollectionService;
    let modelMock: UserBookmarkCollectionModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        modelMock = createTypedModelMock(UserBookmarkCollectionModel, [
            'countActiveByUserId',
            'existsActiveNameForUser',
            'create'
        ]);
        loggerMock = createLoggerMock();
        service = new UserBookmarkCollectionService({ logger: loggerMock }, modelMock);

        // Prevent name-uniqueness check from interfering — assume name is always free.
        asMock(modelMock.existsActiveNameForUser).mockResolvedValue(false);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // TC-1  Under limit: actor has 5 active collections, max = 10 → allowed
    // -----------------------------------------------------------------------
    it('allows creation when active collection count (5) is below default limit (10)', async () => {
        // Arrange
        const actor = makeOwnerActor();
        asMock(modelMock.countActiveByUserId).mockResolvedValue(5);
        asMock(modelMock.create).mockResolvedValue({
            id: getMockId('userBookmark', 'col-1'),
            userId: OWNER_ID,
            name: 'My Wishlist',
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Act
        const result = await service.create(actor, makeCreateInput());

        // Assert
        expect(result.error).toBeUndefined();
        expect(asMock(modelMock.countActiveByUserId)).toHaveBeenCalledWith(OWNER_ID, undefined);
    });

    // -----------------------------------------------------------------------
    // TC-2  At limit: actor has 10 active collections, max = 10 → QUOTA_EXCEEDED
    // -----------------------------------------------------------------------
    it('rejects creation when active collection count equals the default limit (10)', async () => {
        // Arrange
        const actor = makeOwnerActor();
        asMock(modelMock.countActiveByUserId).mockResolvedValue(10);

        // Act
        const result = await service.create(actor, makeCreateInput());

        // Assert
        expect(result.error?.code).toBe('QUOTA_EXCEEDED');
        expect((result.error?.details as { currentCount?: number })?.currentCount).toBe(10);
        expect((result.error?.details as { maxAllowed?: number })?.maxAllowed).toBe(10);
    });

    // -----------------------------------------------------------------------
    // TC-3  Over limit: actor has 12 active collections, max = 10 → QUOTA_EXCEEDED
    // -----------------------------------------------------------------------
    it('rejects creation when active collection count exceeds the default limit (12 > 10)', async () => {
        // Arrange
        const actor = makeOwnerActor();
        asMock(modelMock.countActiveByUserId).mockResolvedValue(12);

        // Act
        const result = await service.create(actor, makeCreateInput());

        // Assert
        expect(result.error?.code).toBe('QUOTA_EXCEEDED');
        expect((result.error?.details as { currentCount?: number })?.currentCount).toBe(12);
        expect((result.error?.details as { maxAllowed?: number })?.maxAllowed).toBe(10);
    });

    // -----------------------------------------------------------------------
    // TC-4  Env override high: max = 20, count = 15 → allowed
    // -----------------------------------------------------------------------
    it('allows creation when count (15) is below an env-overridden limit (20)', async () => {
        // Arrange
        vi.stubEnv('HOSPEDA_MAX_COLLECTIONS_PER_USER', '20');
        const actor = makeOwnerActor();
        asMock(modelMock.countActiveByUserId).mockResolvedValue(15);
        asMock(modelMock.create).mockResolvedValue({
            id: getMockId('userBookmark', 'col-2'),
            userId: OWNER_ID,
            name: 'My Wishlist',
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Act
        const result = await service.create(actor, makeCreateInput());

        // Assert
        expect(result.error).toBeUndefined();
    });

    // -----------------------------------------------------------------------
    // TC-5  Env override low: max = 3, count = 3 → QUOTA_EXCEEDED
    // -----------------------------------------------------------------------
    it('rejects creation when count equals an env-overridden low limit (3)', async () => {
        // Arrange
        vi.stubEnv('HOSPEDA_MAX_COLLECTIONS_PER_USER', '3');
        const actor = makeOwnerActor();
        asMock(modelMock.countActiveByUserId).mockResolvedValue(3);

        // Act
        const result = await service.create(actor, makeCreateInput());

        // Assert
        expect(result.error?.code).toBe('QUOTA_EXCEEDED');
        expect((result.error?.details as { currentCount?: number })?.currentCount).toBe(3);
        expect((result.error?.details as { maxAllowed?: number })?.maxAllowed).toBe(3);
    });

    // -----------------------------------------------------------------------
    // TC-6  Default fallback: env var absent → limit is 10
    // -----------------------------------------------------------------------
    it('falls back to default limit of 10 when env var is not set', async () => {
        // Arrange — ensure the var is absent (afterEach unstubs, beforeEach starts fresh)
        vi.stubEnv('HOSPEDA_MAX_COLLECTIONS_PER_USER', '');
        const actor = makeOwnerActor();
        // 9 collections → should be allowed (below default 10)
        asMock(modelMock.countActiveByUserId).mockResolvedValue(9);
        asMock(modelMock.create).mockResolvedValue({
            id: getMockId('userBookmark', 'col-3'),
            userId: OWNER_ID,
            name: 'My Wishlist',
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Act
        const result = await service.create(actor, makeCreateInput());

        // Assert: no error means the limit resolved to >=10 (default)
        expect(result.error).toBeUndefined();
    });

    // -----------------------------------------------------------------------
    // TC-7  Soft-deleted collections excluded: only ACTIVE ones count
    // -----------------------------------------------------------------------
    it('uses countActiveByUserId (excludes soft-deleted) to determine the quota', async () => {
        // Arrange
        const actor = makeOwnerActor();
        // Simulate 5 active collections; soft-deleted ones are not counted
        // because the model method only queries rows where deletedAt IS NULL.
        asMock(modelMock.countActiveByUserId).mockResolvedValue(5);
        asMock(modelMock.create).mockResolvedValue({
            id: getMockId('userBookmark', 'col-4'),
            userId: OWNER_ID,
            name: 'My Wishlist',
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Act
        const result = await service.create(actor, makeCreateInput());

        // Assert: _canCreate calls countActiveByUserId (not a generic count), so
        // the mock confirms only the active-collection query is used for quota.
        expect(asMock(modelMock.countActiveByUserId)).toHaveBeenCalledTimes(1);
        expect(asMock(modelMock.countActiveByUserId)).toHaveBeenCalledWith(OWNER_ID, undefined);
        expect(result.error).toBeUndefined();
    });

    // -----------------------------------------------------------------------
    // TC-8  Owner mismatch: actor.id !== input.userId → FORBIDDEN, not QUOTA_EXCEEDED
    // -----------------------------------------------------------------------
    it('returns FORBIDDEN (not QUOTA_EXCEEDED) when input.userId does not match actor.id', async () => {
        // Arrange
        const actor = makeOwnerActor(OWNER_ID);
        const differentUserId = getMockId('user', 'different-user');
        // Even if count is 0 the permission check fires first
        asMock(modelMock.countActiveByUserId).mockResolvedValue(0);

        // Act
        const result = await service.create(actor, makeCreateInput(differentUserId));

        // Assert
        expect(result.error?.code).toBe('FORBIDDEN');
        // Quota check must NOT have been reached
        expect(asMock(modelMock.countActiveByUserId)).not.toHaveBeenCalled();
    });
});
