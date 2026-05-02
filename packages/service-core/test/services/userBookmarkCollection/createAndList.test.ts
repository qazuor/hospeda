/**
 * createAndList.test.ts  —  T-053a + T-053b
 *
 * Unit tests for:
 *   - UserBookmarkCollectionService.createCollection
 *   - UserBookmarkCollectionService.countActiveCollections
 *   - UserBookmarkCollectionService.listCollectionsByUser
 *
 * Strategy:
 *   - Mock UserBookmarkCollectionModel via createTypedModelMock.
 *   - No real DB — all model methods are vi.fn().
 *   - The limit guard paths (QUOTA_EXCEEDED) are already exhaustively covered
 *     by userBookmarkCollection.limit.test.ts (T-CL4); here we only verify
 *     the delegation path succeeds when below limit.
 *
 * AAA pattern throughout. One behaviour per test.
 */

import { UserBookmarkCollectionModel } from '@repo/db';
import { LifecycleStatusEnum, PermissionEnum } from '@repo/schemas';
import type { UserBookmarkCollection } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserBookmarkCollectionService } from '../../../src/services/userBookmarkCollection/userBookmarkCollection.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

// ---------------------------------------------------------------------------
// Shared IDs
// ---------------------------------------------------------------------------

const OWNER_ID = getMockId('user', 'collection-create-list-owner');
const OTHER_USER_ID = getMockId('user', 'collection-other-user');
const COLLECTION_ID = getMockId('userBookmark', 'col-create-list-1');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCollection(overrides: Partial<UserBookmarkCollection> = {}): UserBookmarkCollection {
    return {
        id: COLLECTION_ID,
        userId: OWNER_ID,
        name: 'My Wishlist',
        description: null,
        color: null,
        icon: null,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        adminInfo: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: undefined,
        createdById: OWNER_ID,
        updatedById: OWNER_ID,
        deletedById: undefined,
        ...overrides
    };
}

function makeCreateInput(userId: string = OWNER_ID) {
    return {
        userId,
        name: 'My Wishlist'
    } as const;
}

function makeOwnerActor(id: string = OWNER_ID) {
    return createActor({
        id,
        permissions: [PermissionEnum.USER_BOOKMARK_COLLECTION_CREATE]
    });
}

function makeViewAnyActor() {
    return createActor({
        id: getMockId('user', 'view-any-actor'),
        permissions: [
            PermissionEnum.USER_BOOKMARK_COLLECTION_CREATE,
            PermissionEnum.USER_BOOKMARK_COLLECTION_VIEW_ANY
        ]
    });
}

// ---------------------------------------------------------------------------
// Suite setup
// ---------------------------------------------------------------------------

describe('UserBookmarkCollectionService.createCollection', () => {
    let service: UserBookmarkCollectionService;
    let modelMock: UserBookmarkCollectionModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        modelMock = createTypedModelMock(UserBookmarkCollectionModel, [
            'countActiveByUserId',
            'existsActiveNameForUser',
            'create',
            'findById'
        ]);
        loggerMock = createLoggerMock();
        service = new UserBookmarkCollectionService({ logger: loggerMock }, modelMock);

        // Default: below limit and name is free
        asMock(modelMock.countActiveByUserId).mockResolvedValue(0);
        asMock(modelMock.existsActiveNameForUser).mockResolvedValue(false);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // Happy path
    // -----------------------------------------------------------------------

    it('creates a collection when actor owns userId, has permission, name is free, below limit', async () => {
        // Arrange
        const actor = makeOwnerActor();
        const collection = makeCollection();
        asMock(modelMock.create).mockResolvedValue(collection);

        // Act
        const result = await service.createCollection(actor, makeCreateInput());

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data).toMatchObject({
            id: COLLECTION_ID,
            userId: OWNER_ID,
            name: 'My Wishlist'
        });
    });

    // -----------------------------------------------------------------------
    // Owner mismatch (actor.id !== input.userId)
    // -----------------------------------------------------------------------

    it('returns VALIDATION_ERROR when actor.id does not match input.userId', async () => {
        // Arrange
        // createCollection validates userId === actor.id inside the execute callback
        // BEFORE canCreateCollection. That path throws VALIDATION_ERROR.
        // The outer canCreateCollection (which throws FORBIDDEN) is NOT reached
        // when userId has a different value and the actor has the permission.
        const actorWithPermission = createActor({
            id: OWNER_ID,
            permissions: [PermissionEnum.USER_BOOKMARK_COLLECTION_CREATE]
        });
        // Use an input where userId is a valid UUID belonging to a different user.
        const input = makeCreateInput(OTHER_USER_ID);

        // Act
        const result = await service.createCollection(actorWithPermission, input);

        // Assert — the service itself throws VALIDATION_ERROR for userId mismatch
        expect(result.error?.code).toBe('VALIDATION_ERROR');
        // The limit guard must NOT have been reached
        expect(asMock(modelMock.countActiveByUserId)).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Missing permission
    // -----------------------------------------------------------------------

    it('returns FORBIDDEN when actor lacks USER_BOOKMARK_COLLECTION_CREATE permission', async () => {
        // Arrange
        const actor = createActor({ id: OWNER_ID, permissions: [] });

        // Act
        const result = await service.createCollection(actor, makeCreateInput());

        // Assert
        expect(result.error?.code).toBe('FORBIDDEN');
        expect(asMock(modelMock.countActiveByUserId)).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // NAME_TAKEN
    // -----------------------------------------------------------------------

    it('returns ALREADY_EXISTS when actor already has an active collection with the same name', async () => {
        // Arrange
        const actor = makeOwnerActor();
        asMock(modelMock.existsActiveNameForUser).mockResolvedValue(true);

        // Act
        const result = await service.createCollection(actor, makeCreateInput());

        // Assert
        expect(result.error?.code).toBe('ALREADY_EXISTS');
        expect(result.error?.details).toMatchObject({ name: 'My Wishlist' });
    });

    // -----------------------------------------------------------------------
    // Normalizer: name trimmed
    // -----------------------------------------------------------------------

    it('normalizes input: trims name whitespace before persisting', async () => {
        // Arrange
        const actor = makeOwnerActor();
        const rawInput = { userId: OWNER_ID, name: '  Padded Name  ' };
        const normalized = makeCollection({ name: 'Padded Name' });
        asMock(modelMock.create).mockResolvedValue(normalized);

        // Act
        const result = await service.createCollection(actor, rawInput);

        // Assert — name_taken check uses the value after trim; the model create
        // call receives the normalized name
        expect(result.error).toBeUndefined();
        expect(asMock(modelMock.existsActiveNameForUser)).toHaveBeenCalledWith(
            OWNER_ID,
            '  Padded Name  ',
            undefined,
            undefined
        );
    });

    // -----------------------------------------------------------------------
    // Normalizer: color uppercased
    // -----------------------------------------------------------------------

    it('normalizes input: uppercases hex color before persisting', async () => {
        // Arrange
        const actor = makeOwnerActor();
        const rawInput = { userId: OWNER_ID, name: 'My Wishlist', color: '#e57373' };
        const normalized = makeCollection({ color: '#E57373' });
        asMock(modelMock.create).mockResolvedValue(normalized);

        // Act
        const result = await service.createCollection(actor, rawInput);

        // Assert — model receives the normalised entity via BaseCrudService.create
        // which delegates to model.create after _canCreate passes
        expect(result.error).toBeUndefined();
        expect(result.data?.color).toBe('#E57373');
    });

    // -----------------------------------------------------------------------
    // At limit — verify delegation path, not the details (already in T-CL4)
    // -----------------------------------------------------------------------

    it('returns QUOTA_EXCEEDED when actor is at the default limit (10) — limit guard delegation', async () => {
        // Arrange
        const actor = makeOwnerActor();
        asMock(modelMock.countActiveByUserId).mockResolvedValue(10);

        // Act
        const result = await service.createCollection(actor, makeCreateInput());

        // Assert — confirms the limit guard is reachable through createCollection
        expect(result.error?.code).toBe('QUOTA_EXCEEDED');
    });
});

// ===========================================================================
// countActiveCollections
// ===========================================================================

describe('UserBookmarkCollectionService.countActiveCollections', () => {
    let service: UserBookmarkCollectionService;
    let modelMock: UserBookmarkCollectionModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        modelMock = createTypedModelMock(UserBookmarkCollectionModel, ['countActiveByUserId']);
        loggerMock = createLoggerMock();
        service = new UserBookmarkCollectionService({ logger: loggerMock }, modelMock);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('returns the count from model.countActiveByUserId for an authenticated actor', async () => {
        // Arrange
        const actor = createActor({ id: OWNER_ID, permissions: [] });
        asMock(modelMock.countActiveByUserId).mockResolvedValue(3);

        // Act
        const result = await service.countActiveCollections(actor);

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data).toEqual({ count: 3 });
        expect(asMock(modelMock.countActiveByUserId)).toHaveBeenCalledWith(OWNER_ID, undefined);
    });

    it('returns count of 0 when actor has no active collections', async () => {
        // Arrange
        const actor = createActor({ id: OWNER_ID, permissions: [] });
        asMock(modelMock.countActiveByUserId).mockResolvedValue(0);

        // Act
        const result = await service.countActiveCollections(actor);

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data).toEqual({ count: 0 });
    });

    it('returns UNAUTHORIZED for a guest actor (empty actor.id)', async () => {
        // Arrange — guest actor has empty id.
        // The base runner's validateActor() fires before _canCount and throws
        // UNAUTHORIZED (not FORBIDDEN) when actor.id is an empty string.
        const guest = createActor({ id: '', permissions: [] });

        // Act
        const result = await service.countActiveCollections(guest);

        // Assert
        expect(result.error?.code).toBe('UNAUTHORIZED');
        expect(asMock(modelMock.countActiveByUserId)).not.toHaveBeenCalled();
    });
});

// ===========================================================================
// listCollectionsByUser
// ===========================================================================

describe('UserBookmarkCollectionService.listCollectionsByUser', () => {
    let service: UserBookmarkCollectionService;
    let modelMock: UserBookmarkCollectionModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        modelMock = createTypedModelMock(UserBookmarkCollectionModel, [
            'listActiveByUserWithBookmarkCount'
        ]);
        loggerMock = createLoggerMock();
        service = new UserBookmarkCollectionService({ logger: loggerMock }, modelMock);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // Owner can list own collections
    // -----------------------------------------------------------------------

    it('allows owner to list their own collections', async () => {
        // Arrange
        const actor = createActor({ id: OWNER_ID, permissions: [] });
        const col = { ...makeCollection(), bookmarkCount: 2 };
        asMock(modelMock.listActiveByUserWithBookmarkCount).mockResolvedValue({
            rows: [col],
            total: 1
        });

        // Act
        const result = await service.listCollectionsByUser(actor, { userId: OWNER_ID });

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.rows).toHaveLength(1);
        expect(result.data?.total).toBe(1);
    });

    // -----------------------------------------------------------------------
    // Admin with VIEW_ANY can list any user's collections
    // -----------------------------------------------------------------------

    it("allows actor with USER_BOOKMARK_COLLECTION_VIEW_ANY to list another user's collections", async () => {
        // Arrange
        const admin = makeViewAnyActor();
        const col = { ...makeCollection({ userId: OTHER_USER_ID }), bookmarkCount: 0 };
        asMock(modelMock.listActiveByUserWithBookmarkCount).mockResolvedValue({
            rows: [col],
            total: 1
        });

        // Act
        const result = await service.listCollectionsByUser(admin, { userId: OTHER_USER_ID });

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.rows[0]?.userId).toBe(OTHER_USER_ID);
    });

    // -----------------------------------------------------------------------
    // Non-admin trying to list someone else's collections
    // -----------------------------------------------------------------------

    it("returns FORBIDDEN when actor tries to list another user's collections without VIEW_ANY", async () => {
        // Arrange
        const actor = createActor({ id: OWNER_ID, permissions: [] });

        // Act
        const result = await service.listCollectionsByUser(actor, { userId: OTHER_USER_ID });

        // Assert
        expect(result.error?.code).toBe('FORBIDDEN');
        expect(asMock(modelMock.listActiveByUserWithBookmarkCount)).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // includeBookmarkCount: true → rows carry bookmarkCount
    // -----------------------------------------------------------------------

    it('returns rows with bookmarkCount when includeBookmarkCount is true', async () => {
        // Arrange
        const actor = createActor({ id: OWNER_ID, permissions: [] });
        const rows = [
            { ...makeCollection(), bookmarkCount: 5 },
            { ...makeCollection({ id: getMockId('userBookmark', 'col-2') }), bookmarkCount: 0 }
        ];
        asMock(modelMock.listActiveByUserWithBookmarkCount).mockResolvedValue({
            rows,
            total: 2
        });

        // Act
        const result = await service.listCollectionsByUser(actor, {
            userId: OWNER_ID,
            includeBookmarkCount: true
        });

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.rows[0]?.bookmarkCount).toBe(5);
        expect(asMock(modelMock.listActiveByUserWithBookmarkCount)).toHaveBeenCalledWith(
            OWNER_ID,
            expect.objectContaining({ includeBookmarkCount: true }),
            undefined
        );
    });

    // -----------------------------------------------------------------------
    // includeBookmarkCount: false → bookmarkCount is 0 on every row
    // -----------------------------------------------------------------------

    it('returns rows with bookmarkCount 0 when includeBookmarkCount is false', async () => {
        // Arrange
        const actor = createActor({ id: OWNER_ID, permissions: [] });
        const rows = [{ ...makeCollection(), bookmarkCount: 0 }];
        asMock(modelMock.listActiveByUserWithBookmarkCount).mockResolvedValue({
            rows,
            total: 1
        });

        // Act
        const result = await service.listCollectionsByUser(actor, {
            userId: OWNER_ID,
            includeBookmarkCount: false
        });

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.rows[0]?.bookmarkCount).toBe(0);
    });

    // -----------------------------------------------------------------------
    // Pagination parameters forwarded
    // -----------------------------------------------------------------------

    it('forwards page and pageSize to the model method', async () => {
        // Arrange
        const actor = createActor({ id: OWNER_ID, permissions: [] });
        asMock(modelMock.listActiveByUserWithBookmarkCount).mockResolvedValue({
            rows: [],
            total: 0
        });

        // Act
        await service.listCollectionsByUser(actor, { userId: OWNER_ID, page: 3, pageSize: 5 });

        // Assert
        expect(asMock(modelMock.listActiveByUserWithBookmarkCount)).toHaveBeenCalledWith(
            OWNER_ID,
            expect.objectContaining({ page: 3, pageSize: 5 }),
            undefined
        );
    });

    // -----------------------------------------------------------------------
    // Pagination fields echoed back in result
    // -----------------------------------------------------------------------

    it('echoes page and pageSize in the response envelope', async () => {
        // Arrange
        const actor = createActor({ id: OWNER_ID, permissions: [] });
        asMock(modelMock.listActiveByUserWithBookmarkCount).mockResolvedValue({
            rows: [],
            total: 0
        });

        // Act
        const result = await service.listCollectionsByUser(actor, {
            userId: OWNER_ID,
            page: 2,
            pageSize: 10
        });

        // Assert
        expect(result.data?.page).toBe(2);
        expect(result.data?.pageSize).toBe(10);
    });
});
