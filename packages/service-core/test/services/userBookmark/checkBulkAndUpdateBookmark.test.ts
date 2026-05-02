/**
 * checkBulkAndUpdateBookmark.test.ts  —  T-055
 *
 * Unit tests for the two new UserBookmarkService methods added in T-032/T-034:
 *   - checkBookmarksBulk
 *   - updateBookmark
 *
 * Strategy:
 *   - Mock UserBookmarkModel via createTypedModelMock.
 *   - checkBookmarksBulk calls model.findAll with an inArray extra-condition;
 *     we mock findAll to return a controlled set of bookmarks.
 *   - updateBookmark calls model.findById then model.update.
 *   - No real DB is used.
 *
 * AAA pattern throughout. One behaviour per test.
 */

import { UserBookmarkModel } from '@repo/db';
import { EntityTypeEnum, PermissionEnum } from '@repo/schemas';
import type { UserBookmark } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserBookmarkService } from '../../../src/services/userBookmark/userBookmark.service';
import { createActor } from '../../factories/actorFactory';
import { createMockUserBookmark } from '../../factories/userBookmarkFactory';
import { getMockId } from '../../factories/utilsFactory';
import {
    expectForbiddenError,
    expectNotFoundError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

// ---------------------------------------------------------------------------
// Shared IDs
// ---------------------------------------------------------------------------

const OWNER_ID = getMockId('user', 'bulk-update-owner');
const OTHER_USER_ID = getMockId('user', 'bulk-update-other');
const ENTITY_ID_1 = getMockId('destination', 'bulk-entity-1');
const ENTITY_ID_2 = getMockId('destination', 'bulk-entity-2');
const ENTITY_ID_3 = getMockId('destination', 'bulk-entity-3');
const BOOKMARK_ID = getMockId('userBookmark', 'update-bm-1');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeBookmark(overrides: Partial<UserBookmark> = {}): UserBookmark {
    return createMockUserBookmark({
        id: BOOKMARK_ID,
        userId: OWNER_ID,
        entityId: ENTITY_ID_1,
        entityType: EntityTypeEnum.DESTINATION,
        name: 'My note',
        description: 'A place to visit',
        // Use null (not undefined) for active bookmarks: the service uses
        // `existing.deletedAt !== null` to detect soft-deletes, so undefined
        // would incorrectly be treated as deleted.
        deletedAt: null,
        ...overrides
    });
}

function makeOwnerActor(id: string = OWNER_ID) {
    return createActor({
        id,
        permissions: [PermissionEnum.USER_BOOKMARK_CREATE, PermissionEnum.USER_BOOKMARK_MANAGE]
    });
}

function makeViewAnyActor() {
    return createActor({
        id: getMockId('user', 'bulk-view-any'),
        permissions: [
            PermissionEnum.USER_BOOKMARK_CREATE,
            PermissionEnum.USER_BOOKMARK_MANAGE,
            PermissionEnum.USER_BOOKMARK_VIEW_ANY
        ]
    });
}

// ---------------------------------------------------------------------------
// Suite setup
// ---------------------------------------------------------------------------

describe('UserBookmarkService.checkBookmarksBulk', () => {
    let service: UserBookmarkService;
    let modelMock: UserBookmarkModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        modelMock = createTypedModelMock(UserBookmarkModel, ['findAll', 'findById', 'update']);
        loggerMock = createLoggerMock();
        service = new UserBookmarkService({ logger: loggerMock }, modelMock);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // Happy path: all ids checked, subset bookmarked
    // -----------------------------------------------------------------------

    it('returns isBookmarked true with bookmarkId for bookmarked entities and false for others', async () => {
        // Arrange
        const actor = makeOwnerActor();
        const bm1 = makeBookmark({ entityId: ENTITY_ID_1, id: getMockId('userBookmark', 'bm-c1') });
        // ENTITY_ID_2 is NOT bookmarked; ENTITY_ID_3 is bookmarked
        const bm3 = makeBookmark({ entityId: ENTITY_ID_3, id: getMockId('userBookmark', 'bm-c3') });

        asMock(modelMock.findAll).mockResolvedValue({ items: [bm1, bm3], total: 2 });

        // Act
        const result = await service.checkBookmarksBulk(actor, {
            userId: OWNER_ID,
            entityType: EntityTypeEnum.DESTINATION,
            entityIds: [ENTITY_ID_1, ENTITY_ID_2, ENTITY_ID_3]
        });

        // Assert
        expectSuccess(result);
        expect(result.data?.checks[ENTITY_ID_1]).toEqual({
            isBookmarked: true,
            bookmarkId: bm1.id
        });
        expect(result.data?.checks[ENTITY_ID_2]).toEqual({ isBookmarked: false, bookmarkId: null });
        expect(result.data?.checks[ENTITY_ID_3]).toEqual({
            isBookmarked: true,
            bookmarkId: bm3.id
        });
    });

    // -----------------------------------------------------------------------
    // All IDs already bookmarked
    // -----------------------------------------------------------------------

    it('returns all isBookmarked true when all entities are bookmarked', async () => {
        // Arrange
        const actor = makeOwnerActor();
        const bm1 = makeBookmark({
            entityId: ENTITY_ID_1,
            id: getMockId('userBookmark', 'bm-all-1')
        });
        const bm2 = makeBookmark({
            entityId: ENTITY_ID_2,
            id: getMockId('userBookmark', 'bm-all-2')
        });
        asMock(modelMock.findAll).mockResolvedValue({ items: [bm1, bm2], total: 2 });

        // Act
        const result = await service.checkBookmarksBulk(actor, {
            userId: OWNER_ID,
            entityType: EntityTypeEnum.DESTINATION,
            entityIds: [ENTITY_ID_1, ENTITY_ID_2]
        });

        // Assert
        expectSuccess(result);
        expect(result.data?.checks[ENTITY_ID_1]?.isBookmarked).toBe(true);
        expect(result.data?.checks[ENTITY_ID_2]?.isBookmarked).toBe(true);
    });

    // -----------------------------------------------------------------------
    // Max 100 ids enforced by schema
    // -----------------------------------------------------------------------

    it('returns VALIDATION_ERROR when more than 100 entityIds are provided', async () => {
        // Arrange
        const actor = makeOwnerActor();
        const tooManyIds = Array.from({ length: 101 }, (_, i) =>
            getMockId('destination', `bulk-over-${i}`)
        );

        // Act
        const result = await service.checkBookmarksBulk(actor, {
            userId: OWNER_ID,
            entityType: EntityTypeEnum.DESTINATION,
            entityIds: tooManyIds
        });

        // Assert
        expectValidationError(result);
        expect(asMock(modelMock.findAll)).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Only actor's own bookmarks counted
    // -----------------------------------------------------------------------

    it("passes userId filter to model.findAll so only actor's bookmarks are returned", async () => {
        // Arrange
        const actor = makeOwnerActor();
        asMock(modelMock.findAll).mockResolvedValue({ items: [], total: 0 });

        // Act
        await service.checkBookmarksBulk(actor, {
            userId: OWNER_ID,
            entityType: EntityTypeEnum.DESTINATION,
            entityIds: [ENTITY_ID_1]
        });

        // Assert — findAll must be called with userId in the filter
        expect(asMock(modelMock.findAll)).toHaveBeenCalledWith(
            expect.objectContaining({ userId: OWNER_ID }),
            expect.any(Object),
            expect.any(Array), // inArray extra condition
            undefined // no tx
        );
    });

    // -----------------------------------------------------------------------
    // FORBIDDEN when actor is not the owner
    // -----------------------------------------------------------------------

    it("returns FORBIDDEN when actor tries to check another user's bookmarks without VIEW_ANY", async () => {
        // Arrange
        const actor = makeOwnerActor(OWNER_ID);

        // Act
        const result = await service.checkBookmarksBulk(actor, {
            userId: OTHER_USER_ID,
            entityType: EntityTypeEnum.DESTINATION,
            entityIds: [ENTITY_ID_1]
        });

        // Assert
        expectForbiddenError(result);
        expect(asMock(modelMock.findAll)).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Actor with VIEW_ANY can check another user's bookmarks
    // -----------------------------------------------------------------------

    it("allows actor with USER_BOOKMARK_VIEW_ANY to check another user's bookmarks", async () => {
        // Arrange
        const admin = makeViewAnyActor();
        asMock(modelMock.findAll).mockResolvedValue({ items: [], total: 0 });

        // Act
        const result = await service.checkBookmarksBulk(admin, {
            userId: OTHER_USER_ID,
            entityType: EntityTypeEnum.DESTINATION,
            entityIds: [ENTITY_ID_1]
        });

        // Assert
        expectSuccess(result);
        expect(result.data?.checks[ENTITY_ID_1]).toEqual({
            isBookmarked: false,
            bookmarkId: null
        });
    });

    // -----------------------------------------------------------------------
    // VALIDATION_ERROR when entityIds is empty (min(1))
    // -----------------------------------------------------------------------

    it('returns VALIDATION_ERROR when entityIds array is empty', async () => {
        // Arrange
        const actor = makeOwnerActor();

        // Act
        const result = await service.checkBookmarksBulk(actor, {
            userId: OWNER_ID,
            entityType: EntityTypeEnum.DESTINATION,
            entityIds: []
        });

        // Assert
        expectValidationError(result);
    });
});

// ===========================================================================
// updateBookmark
// ===========================================================================

describe('UserBookmarkService.updateBookmark', () => {
    let service: UserBookmarkService;
    let modelMock: UserBookmarkModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        modelMock = createTypedModelMock(UserBookmarkModel, ['findById', 'update']);
        loggerMock = createLoggerMock();
        service = new UserBookmarkService({ logger: loggerMock }, modelMock);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // Happy path: update name only
    // -----------------------------------------------------------------------

    it('happy path: updates name on bookmark owned by actor', async () => {
        // Arrange
        const actor = makeOwnerActor();
        const existing = makeBookmark();
        const updated = makeBookmark({ name: 'New note' });
        asMock(modelMock.findById).mockResolvedValue(existing);
        asMock(modelMock.update).mockResolvedValue(updated);

        // Act
        const result = await service.updateBookmark(actor, {
            bookmarkId: BOOKMARK_ID,
            input: { name: 'New note' }
        });

        // Assert
        expectSuccess(result);
        expect(result.data?.name).toBe('New note');
    });

    // -----------------------------------------------------------------------
    // Happy path: update description only
    // -----------------------------------------------------------------------

    it('updates description only when name is omitted', async () => {
        // Arrange
        const actor = makeOwnerActor();
        const existing = makeBookmark();
        const updated = makeBookmark({ description: 'New description' });
        asMock(modelMock.findById).mockResolvedValue(existing);
        asMock(modelMock.update).mockResolvedValue(updated);

        // Act
        const result = await service.updateBookmark(actor, {
            bookmarkId: BOOKMARK_ID,
            input: { description: 'New description' }
        });

        // Assert
        expectSuccess(result);
        expect(result.data?.description).toBe('New description');
    });

    // -----------------------------------------------------------------------
    // Happy path: update both name and description
    // -----------------------------------------------------------------------

    it('updates both name and description at once', async () => {
        // Arrange
        const actor = makeOwnerActor();
        const existing = makeBookmark();
        const updated = makeBookmark({ name: 'Updated name', description: 'Updated desc' });
        asMock(modelMock.findById).mockResolvedValue(existing);
        asMock(modelMock.update).mockResolvedValue(updated);

        // Act
        const result = await service.updateBookmark(actor, {
            bookmarkId: BOOKMARK_ID,
            input: { name: 'Updated name', description: 'Updated desc' }
        });

        // Assert
        expectSuccess(result);
        expect(result.data?.name).toBe('Updated name');
        expect(result.data?.description).toBe('Updated desc');
    });

    // -----------------------------------------------------------------------
    // Owner check
    // -----------------------------------------------------------------------

    it('returns FORBIDDEN when actor does not own the bookmark and lacks VIEW_ANY', async () => {
        // Arrange
        const nonOwner = createActor({
            id: OTHER_USER_ID,
            permissions: [PermissionEnum.USER_BOOKMARK_MANAGE]
        });
        asMock(modelMock.findById).mockResolvedValue(makeBookmark());

        // Act
        const result = await service.updateBookmark(nonOwner, {
            bookmarkId: BOOKMARK_ID,
            input: { name: 'Hack' }
        });

        // Assert
        expectForbiddenError(result);
        expect(asMock(modelMock.update)).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // NOT_FOUND when bookmark does not exist
    // -----------------------------------------------------------------------

    it('returns NOT_FOUND when the bookmark does not exist', async () => {
        // Arrange
        const actor = makeOwnerActor();
        asMock(modelMock.findById).mockResolvedValue(null);

        // Act
        const result = await service.updateBookmark(actor, {
            bookmarkId: BOOKMARK_ID,
            input: { name: 'No-op' }
        });

        // Assert
        expectNotFoundError(result);
        expect(asMock(modelMock.update)).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // NOT_FOUND when bookmark is soft-deleted
    // -----------------------------------------------------------------------

    it('returns NOT_FOUND when bookmark is soft-deleted (deletedAt is set)', async () => {
        // Arrange
        const actor = makeOwnerActor();
        asMock(modelMock.findById).mockResolvedValue(
            makeBookmark({ deletedAt: new Date('2025-01-01') })
        );

        // Act
        const result = await service.updateBookmark(actor, {
            bookmarkId: BOOKMARK_ID,
            input: { name: 'No-op' }
        });

        // Assert
        expectNotFoundError(result);
    });

    // -----------------------------------------------------------------------
    // Validation: name max 100 chars
    // -----------------------------------------------------------------------

    it('returns VALIDATION_ERROR when name exceeds 100 characters', async () => {
        // Arrange
        const actor = makeOwnerActor();
        const longName = 'a'.repeat(101);

        // Act
        const result = await service.updateBookmark(actor, {
            bookmarkId: BOOKMARK_ID,
            input: { name: longName }
        });

        // Assert
        expectValidationError(result);
        expect(asMock(modelMock.findById)).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Validation: description max 300 chars
    // -----------------------------------------------------------------------

    it('returns VALIDATION_ERROR when description exceeds 300 characters', async () => {
        // Arrange
        const actor = makeOwnerActor();
        const longDesc = 'b'.repeat(301);

        // Act
        const result = await service.updateBookmark(actor, {
            bookmarkId: BOOKMARK_ID,
            input: { description: longDesc }
        });

        // Assert
        expectValidationError(result);
        expect(asMock(modelMock.findById)).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Actor with VIEW_ANY can update another user's bookmark
    // -----------------------------------------------------------------------

    it("admin with USER_BOOKMARK_VIEW_ANY can update another user's bookmark notes", async () => {
        // Arrange
        const admin = makeViewAnyActor();
        asMock(modelMock.findById).mockResolvedValue(makeBookmark({ userId: OTHER_USER_ID }));
        const updated = makeBookmark({ userId: OTHER_USER_ID, name: 'Admin note' });
        asMock(modelMock.update).mockResolvedValue(updated);

        // Act
        const result = await service.updateBookmark(admin, {
            bookmarkId: BOOKMARK_ID,
            input: { name: 'Admin note' }
        });

        // Assert
        expectSuccess(result);
        expect(result.data?.name).toBe('Admin note');
    });

    // -----------------------------------------------------------------------
    // model.update returns null → NOT_FOUND after update
    // -----------------------------------------------------------------------

    it('returns NOT_FOUND when model.update returns null (race condition)', async () => {
        // Arrange
        const actor = makeOwnerActor();
        asMock(modelMock.findById).mockResolvedValue(makeBookmark());
        asMock(modelMock.update).mockResolvedValue(null);

        // Act
        const result = await service.updateBookmark(actor, {
            bookmarkId: BOOKMARK_ID,
            input: { name: 'Gone' }
        });

        // Assert
        expectNotFoundError(result);
    });

    // -----------------------------------------------------------------------
    // updatedById set to actor.id
    // -----------------------------------------------------------------------

    it('passes actor.id as updatedById to model.update', async () => {
        // Arrange
        const actor = makeOwnerActor();
        const existing = makeBookmark();
        const updated = makeBookmark({ name: 'Tracked' });
        asMock(modelMock.findById).mockResolvedValue(existing);
        asMock(modelMock.update).mockResolvedValue(updated);

        // Act
        await service.updateBookmark(actor, {
            bookmarkId: BOOKMARK_ID,
            input: { name: 'Tracked' }
        });

        // Assert
        expect(asMock(modelMock.update)).toHaveBeenCalledWith(
            { id: BOOKMARK_ID },
            expect.objectContaining({ updatedById: OWNER_ID }),
            undefined
        );
    });
});
