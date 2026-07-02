/**
 * userBookmarkCollection.limit.test.ts
 *
 * Unit tests for the per-user collection quota guard.
 *
 * SPEC-287 (2026-07-01): the quota check moved from `_canCreate` (a
 * BaseCrudService lifecycle hook) into `createCollection()`'s own execute
 * callback. Reason: `BaseCrudService.create()` never forwards `ctx` to
 * `_canCreate` (see BETA-106) — `execCtx` is only reliably available inside
 * `createCollection()`'s own `runWithLoggingAndValidation` callback. The
 * plan-based limit is read from `ctx.hookState.planLimit` (falling back to
 * `DEFAULT_MAX_COLLECTIONS_PER_USER` when absent), replacing the old
 * `HOSPEDA_MAX_COLLECTIONS_PER_USER` env var.
 *
 * Strategy: call the public `service.createCollection()` (the real
 * production entry point — the only caller in apps/api) with a mocked
 * `UserBookmarkCollectionModel` whose `countActiveByUserId` is controlled
 * per test.
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

describe('UserBookmarkCollectionService.createCollection — collection limit guard', () => {
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
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // TC-1  Under default fallback limit: no ctx passed, count (5) < 10 → allowed
    // -----------------------------------------------------------------------
    it('allows creation when active collection count (5) is below the default fallback limit (10)', async () => {
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

        // Act — no ctx passed: planLimit is absent, falls back to default (10)
        const result = await service.createCollection(actor, makeCreateInput());

        // Assert
        expect(result.error).toBeUndefined();
        expect(asMock(modelMock.countActiveByUserId)).toHaveBeenCalledWith(OWNER_ID, undefined);
    });

    // -----------------------------------------------------------------------
    // TC-2  At default fallback limit: count (10) === 10 → QUOTA_EXCEEDED
    // -----------------------------------------------------------------------
    it('rejects creation when active collection count equals the default fallback limit (10)', async () => {
        // Arrange
        const actor = makeOwnerActor();
        asMock(modelMock.countActiveByUserId).mockResolvedValue(10);

        // Act
        const result = await service.createCollection(actor, makeCreateInput());

        // Assert
        expect(result.error?.code).toBe('QUOTA_EXCEEDED');
        expect((result.error?.details as { currentCount?: number })?.currentCount).toBe(10);
        expect((result.error?.details as { maxAllowed?: number })?.maxAllowed).toBe(10);
    });

    // -----------------------------------------------------------------------
    // TC-3  Over default fallback limit: count (12) > 10 → QUOTA_EXCEEDED
    // -----------------------------------------------------------------------
    it('rejects creation when active collection count exceeds the default fallback limit (12 > 10)', async () => {
        // Arrange
        const actor = makeOwnerActor();
        asMock(modelMock.countActiveByUserId).mockResolvedValue(12);

        // Act
        const result = await service.createCollection(actor, makeCreateInput());

        // Assert
        expect(result.error?.code).toBe('QUOTA_EXCEEDED');
        expect((result.error?.details as { currentCount?: number })?.currentCount).toBe(12);
        expect((result.error?.details as { maxAllowed?: number })?.maxAllowed).toBe(10);
    });

    // -----------------------------------------------------------------------
    // TC-4  Explicit plan limit (vip=25 style): planLimit=20, count=15 → allowed
    // -----------------------------------------------------------------------
    it('allows creation when count (15) is below an explicit ctx.hookState.planLimit (20)', async () => {
        // Arrange
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
        const result = await service.createCollection(actor, makeCreateInput(), {
            hookState: { planLimit: 20 }
        });

        // Assert
        expect(result.error).toBeUndefined();
    });

    // -----------------------------------------------------------------------
    // TC-5  Explicit plan limit (plus=10 style): planLimit=3, count=3 → QUOTA_EXCEEDED
    // -----------------------------------------------------------------------
    it('rejects creation when count equals an explicit low ctx.hookState.planLimit (3)', async () => {
        // Arrange
        const actor = makeOwnerActor();
        asMock(modelMock.countActiveByUserId).mockResolvedValue(3);

        // Act
        const result = await service.createCollection(actor, makeCreateInput(), {
            hookState: { planLimit: 3 }
        });

        // Assert
        expect(result.error?.code).toBe('QUOTA_EXCEEDED');
        expect((result.error?.details as { currentCount?: number })?.currentCount).toBe(3);
        expect((result.error?.details as { maxAllowed?: number })?.maxAllowed).toBe(3);
    });

    // -----------------------------------------------------------------------
    // TC-6  hookState present but planLimit key absent → falls back to default (10)
    // -----------------------------------------------------------------------
    it('falls back to the default limit of 10 when hookState is present but planLimit is absent', async () => {
        // Arrange
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

        // Act — hookState object present, but no planLimit key inside it
        const result = await service.createCollection(actor, makeCreateInput(), { hookState: {} });

        // Assert: no error means the limit resolved to the default (10)
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
        const result = await service.createCollection(actor, makeCreateInput());

        // Assert: only the active-collection query is used for the quota check.
        expect(asMock(modelMock.countActiveByUserId)).toHaveBeenCalledTimes(1);
        expect(asMock(modelMock.countActiveByUserId)).toHaveBeenCalledWith(OWNER_ID, undefined);
        expect(result.error).toBeUndefined();
    });

    // -----------------------------------------------------------------------
    // TC-8  Owner mismatch: actor.id !== input.userId → VALIDATION_ERROR, not QUOTA_EXCEEDED
    //
    // Note: `createCollection()`'s own step-1 owner check fires BEFORE the
    // quota check is ever reached, so this is VALIDATION_ERROR (not the
    // FORBIDDEN that `canCreateCollection`/`_canCreate` would throw via a
    // direct `service.create()` call — a path production code never takes).
    // -----------------------------------------------------------------------
    it('returns VALIDATION_ERROR (not QUOTA_EXCEEDED) when input.userId does not match actor.id', async () => {
        // Arrange
        const actor = makeOwnerActor(OWNER_ID);
        const differentUserId = getMockId('user', 'different-user');
        // Even if count is 0 the owner check fires first
        asMock(modelMock.countActiveByUserId).mockResolvedValue(0);

        // Act
        const result = await service.createCollection(actor, makeCreateInput(differentUserId));

        // Assert
        expect(result.error?.code).toBe('VALIDATION_ERROR');
        // Quota check must NOT have been reached
        expect(asMock(modelMock.countActiveByUserId)).not.toHaveBeenCalled();
    });
});
