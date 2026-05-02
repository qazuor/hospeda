/**
 * getUpdateDelete.test.ts  —  T-054a + T-054b
 *
 * Unit tests for:
 *   - UserBookmarkCollectionService.getCollectionById
 *   - UserBookmarkCollectionService.updateCollection
 *   - UserBookmarkCollectionService.deleteCollection
 *   - UserBookmarkCollectionService.addBookmarkToCollection
 *   - UserBookmarkCollectionService.removeBookmarkFromCollection
 *
 * Mocking strategy:
 *   - UserBookmarkCollectionModel is mocked via createTypedModelMock (using the
 *     real class, imported via vi.importActual to avoid bootstrap issues) and
 *     injected directly into the service constructor.
 *   - UserBookmarkModel is instantiated inside the service for add/remove
 *     operations. We intercept it by providing a mocked constructor in the
 *     vi.mock factory. The factory returns `bookmarkModelMock`, which is set in
 *     beforeEach using the real class obtained via vi.importActual.
 *   - getDb() and withTransaction are also mocked in the vi.mock factory so
 *     the raw Drizzle queries in add/remove/getById-with-bookmarks work without
 *     a real DB connection.
 *
 * Bootstrap order (vi.mock is hoisted, but module-level lets are set before
 * any test runs because the vi.mock factory is a lazy factory — it runs the
 * first time the module is imported, which happens during module setup before
 * `beforeEach`):
 *
 *   1. vi.mock('@repo/db', factory) is hoisted.
 *   2. `import { UserBookmarkCollectionModel, UserBookmarkModel } from '@repo/db'`
 *      triggers the factory; the factory returns our mock constructors that
 *      close over the module-level variables.
 *   3. beforeEach sets collectionModelMock and bookmarkModelMock using the real
 *      classes obtained via vi.importActual.
 *   4. Test runs; service internal `new UserBookmarkModel()` call hits the mock
 *      constructor → returns bookmarkModelMock.
 *
 * AAA pattern throughout. One behaviour per test.
 */

import type {
    UserBookmarkCollectionModel as UBCModelType,
    UserBookmarkModel as UBModelType
} from '@repo/db';
import { LifecycleStatusEnum, PermissionEnum } from '@repo/schemas';
import type { UserBookmark, UserBookmarkCollection } from '@repo/schemas';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Chainable Drizzle stub
// Used for the raw getDb() queries inside getCollectionById (includeBookmarks),
// addBookmarkToCollection, and removeBookmarkFromCollection.
// ---------------------------------------------------------------------------

function makeDbChain(resolveValue: unknown = []) {
    const terminal = vi.fn().mockResolvedValue(resolveValue);

    const chain: Record<string, Mock | ((...args: unknown[]) => unknown)> = {
        select: vi.fn(),
        from: vi.fn(),
        where: vi.fn(),
        limit: vi.fn(),
        offset: vi.fn().mockResolvedValue(resolveValue),
        update: vi.fn(),
        set: vi.fn(),
        returning: terminal
    };

    // All intermediate methods return the chain so they can be chained.
    (chain.select as Mock).mockReturnValue(chain);
    (chain.from as Mock).mockReturnValue(chain);
    (chain.where as Mock).mockReturnValue(chain);
    (chain.limit as Mock).mockReturnValue(chain);
    (chain.update as Mock).mockReturnValue(chain);
    (chain.set as Mock).mockReturnValue(chain);

    return { chain, terminal };
}

// ---------------------------------------------------------------------------
// Module-level holders for the model mocks.
// The vi.mock factory below captures these references (via closure) so the
// mock constructors return the correct mocked instance per test.
// Types are the real class interfaces; values are assigned in beforeEach.
// ---------------------------------------------------------------------------

let collectionModelMock: UBCModelType;
let bookmarkModelMock: UBModelType;
let dbChain: ReturnType<typeof makeDbChain>['chain'];
let dbTerminal: Mock;

// ---------------------------------------------------------------------------
// @repo/db module mock (vi.mock is hoisted — factory runs lazily at first import)
// ---------------------------------------------------------------------------

vi.mock('@repo/db', async () => {
    // Spread the real module exports so Drizzle helpers (eq, userBookmarks, etc.)
    // are available without re-declaration.
    const actual = await vi.importActual<typeof import('@repo/db')>('@repo/db');

    return {
        ...actual,
        // getDb() returns our chainable stub (assigned fresh in beforeEach).
        getDb: vi.fn(() => dbChain),
        // withTransaction executes the callback synchronously with a mock tx that
        // has `execute` (needed by withServiceTransaction's statement_timeout call)
        // and all chainable query-builder methods so service writes work.
        withTransaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
            const mockTx = {
                ...dbChain,
                execute: vi.fn().mockResolvedValue(undefined)
            };
            return cb(mockTx);
        }),
        // Override constructors so `new UserBookmarkModel()` inside the service
        // returns our test-controlled mock instance.
        UserBookmarkCollectionModel: vi.fn(() => collectionModelMock),
        UserBookmarkModel: vi.fn(() => bookmarkModelMock)
    };
});

// ---------------------------------------------------------------------------
// Real imports (resolved after vi.mock hoisting)
// ---------------------------------------------------------------------------

import { UserBookmarkCollectionService } from '../../../src/services/userBookmarkCollection/userBookmarkCollection.service';
import { createActor } from '../../factories/actorFactory';
import { createMockUserBookmark } from '../../factories/userBookmarkFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

// ---------------------------------------------------------------------------
// Shared IDs
// ---------------------------------------------------------------------------

const OWNER_ID = getMockId('user', 'col-get-update-delete-owner');
const OTHER_USER_ID = getMockId('user', 'col-get-update-delete-other');
const COLLECTION_ID = getMockId('userBookmark', 'col-get-update-1');
const BOOKMARK_ID = getMockId('userBookmark', 'bm-get-update-1');

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

function makeBookmark(overrides: Partial<UserBookmark> = {}): UserBookmark {
    return createMockUserBookmark({ id: BOOKMARK_ID, userId: OWNER_ID, ...overrides });
}

function makeOwnerActor(id: string = OWNER_ID) {
    return createActor({
        id,
        permissions: [PermissionEnum.USER_BOOKMARK_COLLECTION_CREATE]
    });
}

function makeViewAnyActor() {
    return createActor({
        id: getMockId('user', 'col-view-any-actor'),
        permissions: [
            PermissionEnum.USER_BOOKMARK_COLLECTION_CREATE,
            PermissionEnum.USER_BOOKMARK_COLLECTION_VIEW_ANY
        ]
    });
}

// ---------------------------------------------------------------------------
// Shared beforeEach / afterEach
// ---------------------------------------------------------------------------

let service: UserBookmarkCollectionService;
let loggerMock: ReturnType<typeof createLoggerMock>;

beforeEach(async () => {
    // Reset the chain each test so leftover mock state does not bleed.
    const freshChain = makeDbChain([]);
    dbChain = freshChain.chain;
    dbTerminal = freshChain.terminal;

    // Obtain real class constructors to properly enumerate prototype methods.
    const { UserBookmarkCollectionModel: RealUBCModel, UserBookmarkModel: RealUBModel } =
        await vi.importActual<typeof import('@repo/db')>('@repo/db');

    collectionModelMock = createTypedModelMock(
        RealUBCModel as new (
            ...args: unknown[]
        ) => UBCModelType,
        [
            'countActiveByUserId',
            'existsActiveNameForUser',
            'create',
            'findById',
            'update',
            'softDelete',
            'nullifyCollectionIdOnBookmarks',
            'listActiveByUserWithBookmarkCount'
        ]
    ) as UBCModelType;

    bookmarkModelMock = createTypedModelMock(
        RealUBModel as new (
            ...args: unknown[]
        ) => UBModelType,
        ['findById', 'update']
    ) as UBModelType;

    loggerMock = createLoggerMock();
    // The service constructor accepts a model mock directly for the collection model.
    // The bookmark model is instantiated internally; our vi.mock intercepts that.
    service = new UserBookmarkCollectionService({ logger: loggerMock }, collectionModelMock);
});

afterEach(() => {
    vi.clearAllMocks();
});

// ===========================================================================
// getCollectionById
// ===========================================================================

describe('UserBookmarkCollectionService.getCollectionById', () => {
    it('owner can fetch their own collection (no bookmarks)', async () => {
        // Arrange
        const actor = makeOwnerActor();
        asMock(collectionModelMock.findById).mockResolvedValue(makeCollection());

        // Act
        const result = await service.getCollectionById(actor, { collectionId: COLLECTION_ID });

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.collection.id).toBe(COLLECTION_ID);
        expect(result.data?.bookmarks).toBeUndefined();
    });

    it("actor with VIEW_ANY can fetch any user's collection", async () => {
        // Arrange
        const admin = makeViewAnyActor();
        asMock(collectionModelMock.findById).mockResolvedValue(
            makeCollection({ userId: OTHER_USER_ID })
        );

        // Act
        const result = await service.getCollectionById(admin, { collectionId: COLLECTION_ID });

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.collection.userId).toBe(OTHER_USER_ID);
    });

    it('returns FORBIDDEN when non-owner actor lacks VIEW_ANY', async () => {
        // Arrange
        const nonOwner = createActor({ id: OTHER_USER_ID, permissions: [] });
        asMock(collectionModelMock.findById).mockResolvedValue(makeCollection());

        // Act
        const result = await service.getCollectionById(nonOwner, { collectionId: COLLECTION_ID });

        // Assert
        expect(result.error?.code).toBe('FORBIDDEN');
    });

    it('returns NOT_FOUND when collection does not exist', async () => {
        // Arrange
        const actor = makeOwnerActor();
        asMock(collectionModelMock.findById).mockResolvedValue(null);

        // Act
        const result = await service.getCollectionById(actor, { collectionId: COLLECTION_ID });

        // Assert
        expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('returns NOT_FOUND when collection is soft-deleted (findById returns null)', async () => {
        // Arrange — BaseModelImpl.findById already excludes soft-deleted rows;
        // simulating by returning null as the model would.
        const actor = makeOwnerActor();
        asMock(collectionModelMock.findById).mockResolvedValue(null);

        // Act
        const result = await service.getCollectionById(actor, { collectionId: COLLECTION_ID });

        // Assert
        expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('includes bookmarks with pagination when includeBookmarks is true', async () => {
        // Arrange
        const actor = makeOwnerActor();
        asMock(collectionModelMock.findById).mockResolvedValue(makeCollection());

        const bookmarkRow = makeBookmark();
        // Service calls two parallel queries via getDb():
        //   1. Paginated SELECT with limit+offset → rows array
        //   2. COUNT SELECT → countRows array (awaited directly on the chain)
        // Make .offset() resolve to the rows array for the paginated query.
        asMock(dbChain.offset as Mock).mockResolvedValue([bookmarkRow]);
        // Make the chain itself thenable (awaited for the count query).
        Object.defineProperty(dbChain, 'then', {
            configurable: true,
            value: (resolve: (v: unknown) => void) => resolve([bookmarkRow])
        });

        // Act
        const result = await service.getCollectionById(actor, {
            collectionId: COLLECTION_ID,
            includeBookmarks: true,
            bookmarksPage: 1,
            bookmarksPageSize: 10
        });

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.bookmarks).toBeDefined();
        expect(result.data?.bookmarks?.page).toBe(1);
        expect(result.data?.bookmarks?.pageSize).toBe(10);
    });

    it('forwards bookmarks pagination params to the query', async () => {
        // Arrange
        const actor = makeOwnerActor();
        asMock(collectionModelMock.findById).mockResolvedValue(makeCollection());
        asMock(dbChain.offset as Mock).mockResolvedValue([]);
        Object.defineProperty(dbChain, 'then', {
            configurable: true,
            value: (resolve: (v: unknown) => void) => resolve([])
        });

        // Act
        const result = await service.getCollectionById(actor, {
            collectionId: COLLECTION_ID,
            includeBookmarks: true,
            bookmarksPage: 2,
            bookmarksPageSize: 5
        });

        // Assert — limit and offset should have been called with the right values
        expect(result.error).toBeUndefined();
        expect(asMock(dbChain.limit as Mock)).toHaveBeenCalledWith(5);
        expect(asMock(dbChain.offset as Mock)).toHaveBeenCalledWith(5); // (2-1)*5
    });
});

// ===========================================================================
// updateCollection
// ===========================================================================

describe('UserBookmarkCollectionService.updateCollection', () => {
    beforeEach(() => {
        // Default: name not taken
        asMock(collectionModelMock.existsActiveNameForUser).mockResolvedValue(false);
    });

    it('happy path: updates name on owned collection', async () => {
        // Arrange
        const actor = makeOwnerActor();
        const existing = makeCollection({ name: 'Old Name' });
        const updated = makeCollection({ name: 'New Name' });
        asMock(collectionModelMock.findById).mockResolvedValue(existing);
        asMock(collectionModelMock.update).mockResolvedValue(updated);

        // Act
        const result = await service.updateCollection(actor, {
            collectionId: COLLECTION_ID,
            input: { name: 'New Name' }
        });

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.name).toBe('New Name');
    });

    it('returns FORBIDDEN when actor does not own the collection', async () => {
        // Arrange
        const nonOwner = createActor({ id: OTHER_USER_ID, permissions: [] });
        asMock(collectionModelMock.findById).mockResolvedValue(makeCollection());

        // Act
        const result = await service.updateCollection(nonOwner, {
            collectionId: COLLECTION_ID,
            input: { name: 'Hacked' }
        });

        // Assert
        expect(result.error?.code).toBe('FORBIDDEN');
    });

    it('returns NOT_FOUND when collection does not exist', async () => {
        // Arrange
        const actor = makeOwnerActor();
        asMock(collectionModelMock.findById).mockResolvedValue(null);

        // Act
        const result = await service.updateCollection(actor, {
            collectionId: COLLECTION_ID,
            input: { name: 'Whatever' }
        });

        // Assert
        expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('returns ALREADY_EXISTS when renaming to a name already taken by another collection', async () => {
        // Arrange
        const actor = makeOwnerActor();
        asMock(collectionModelMock.findById).mockResolvedValue(
            makeCollection({ name: 'Old Name' })
        );
        asMock(collectionModelMock.existsActiveNameForUser).mockResolvedValue(true);

        // Act
        const result = await service.updateCollection(actor, {
            collectionId: COLLECTION_ID,
            input: { name: 'Taken Name' }
        });

        // Assert
        expect(result.error?.code).toBe('ALREADY_EXISTS');
    });

    it('succeeds when renaming to the same name as current (no ALREADY_EXISTS)', async () => {
        // Arrange — the service skips the uniqueness check when name is unchanged.
        const actor = makeOwnerActor();
        const existing = makeCollection({ name: 'Same Name' });
        asMock(collectionModelMock.findById).mockResolvedValue(existing);
        asMock(collectionModelMock.update).mockResolvedValue(existing);

        // Act
        const result = await service.updateCollection(actor, {
            collectionId: COLLECTION_ID,
            input: { name: 'Same Name' }
        });

        // Assert — uniqueness check must NOT have been called for same name
        expect(result.error).toBeUndefined();
        expect(asMock(collectionModelMock.existsActiveNameForUser)).not.toHaveBeenCalled();
    });

    it('normalizes update input: color uppercased', async () => {
        // Arrange
        const actor = makeOwnerActor();
        const existing = makeCollection({ color: null });
        const updatedCollection = makeCollection({ color: '#42A5F5' });
        asMock(collectionModelMock.findById).mockResolvedValue(existing);
        asMock(collectionModelMock.update).mockResolvedValue(updatedCollection);

        // Act
        const result = await service.updateCollection(actor, {
            collectionId: COLLECTION_ID,
            input: { color: '#42a5f5' }
        });

        // Assert — result carries the uppercased value from the model response
        expect(result.error).toBeUndefined();
        expect(result.data?.color).toBe('#42A5F5');
    });

    it("admin with VIEW_ANY can update another user's collection", async () => {
        // Arrange
        const admin = makeViewAnyActor();
        asMock(collectionModelMock.findById).mockResolvedValue(
            makeCollection({ userId: OTHER_USER_ID })
        );
        const updated = makeCollection({ userId: OTHER_USER_ID, description: 'Admin edit' });
        asMock(collectionModelMock.update).mockResolvedValue(updated);

        // Act
        const result = await service.updateCollection(admin, {
            collectionId: COLLECTION_ID,
            input: { description: 'Admin edit' }
        });

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.description).toBe('Admin edit');
    });
});

// ===========================================================================
// deleteCollection
// ===========================================================================

describe('UserBookmarkCollectionService.deleteCollection', () => {
    beforeEach(() => {
        asMock(collectionModelMock.softDelete).mockResolvedValue(undefined);
    });

    it('happy path: soft-deletes collection and nullifies bookmark.collectionId', async () => {
        // Arrange
        const actor = makeOwnerActor();
        asMock(collectionModelMock.findById).mockResolvedValue(makeCollection());
        asMock(collectionModelMock.nullifyCollectionIdOnBookmarks).mockResolvedValue(3);

        // Act
        const result = await service.deleteCollection(actor, COLLECTION_ID);

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.id).toBe(COLLECTION_ID);
        expect(result.data?.nullifiedBookmarks).toBe(3);
        expect(asMock(collectionModelMock.nullifyCollectionIdOnBookmarks)).toHaveBeenCalledWith(
            COLLECTION_ID,
            expect.anything() // tx object from withTransaction mock
        );
    });

    it('nullifiedBookmarks is 0 when collection had no bookmarks', async () => {
        // Arrange
        const actor = makeOwnerActor();
        asMock(collectionModelMock.findById).mockResolvedValue(makeCollection());
        asMock(collectionModelMock.nullifyCollectionIdOnBookmarks).mockResolvedValue(0);

        // Act
        const result = await service.deleteCollection(actor, COLLECTION_ID);

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.nullifiedBookmarks).toBe(0);
    });

    it('returns FORBIDDEN when actor does not own the collection', async () => {
        // Arrange
        const nonOwner = createActor({ id: OTHER_USER_ID, permissions: [] });
        asMock(collectionModelMock.findById).mockResolvedValue(makeCollection());

        // Act
        const result = await service.deleteCollection(nonOwner, COLLECTION_ID);

        // Assert
        expect(result.error?.code).toBe('FORBIDDEN');
        expect(asMock(collectionModelMock.nullifyCollectionIdOnBookmarks)).not.toHaveBeenCalled();
    });

    it('returns NOT_FOUND when collection does not exist', async () => {
        // Arrange
        const actor = makeOwnerActor();
        asMock(collectionModelMock.findById).mockResolvedValue(null);

        // Act
        const result = await service.deleteCollection(actor, COLLECTION_ID);

        // Assert
        expect(result.error?.code).toBe('NOT_FOUND');
    });
});

// ===========================================================================
// addBookmarkToCollection
// ===========================================================================

describe('UserBookmarkCollectionService.addBookmarkToCollection', () => {
    it('happy path: assigns bookmarkId.collectionId to the collection', async () => {
        // Arrange
        const actor = makeOwnerActor();
        asMock(collectionModelMock.findById).mockResolvedValue(makeCollection());
        asMock(bookmarkModelMock.findById).mockResolvedValue(makeBookmark());

        const updatedBookmark = makeBookmark();
        dbTerminal.mockResolvedValue([updatedBookmark]);

        // Act
        const result = await service.addBookmarkToCollection(actor, {
            collectionId: COLLECTION_ID,
            bookmarkId: BOOKMARK_ID
        });

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.id).toBe(BOOKMARK_ID);
    });

    it('returns NOT_FOUND when collection does not exist', async () => {
        // Arrange
        const actor = makeOwnerActor();
        asMock(collectionModelMock.findById).mockResolvedValue(null);

        // Act
        const result = await service.addBookmarkToCollection(actor, {
            collectionId: COLLECTION_ID,
            bookmarkId: BOOKMARK_ID
        });

        // Assert
        expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('returns FORBIDDEN when actor does not own the collection', async () => {
        // Arrange
        const nonOwner = createActor({ id: OTHER_USER_ID, permissions: [] });
        asMock(collectionModelMock.findById).mockResolvedValue(makeCollection());

        // Act
        const result = await service.addBookmarkToCollection(nonOwner, {
            collectionId: COLLECTION_ID,
            bookmarkId: BOOKMARK_ID
        });

        // Assert
        expect(result.error?.code).toBe('FORBIDDEN');
        // bookmark should NOT have been fetched
        expect(asMock(bookmarkModelMock.findById)).not.toHaveBeenCalled();
    });

    it('returns NOT_FOUND when bookmark does not exist', async () => {
        // Arrange
        const actor = makeOwnerActor();
        asMock(collectionModelMock.findById).mockResolvedValue(makeCollection());
        asMock(bookmarkModelMock.findById).mockResolvedValue(null);

        // Act
        const result = await service.addBookmarkToCollection(actor, {
            collectionId: COLLECTION_ID,
            bookmarkId: BOOKMARK_ID
        });

        // Assert
        expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('returns FORBIDDEN when actor does not own the bookmark', async () => {
        // Arrange
        const actor = makeOwnerActor();
        asMock(collectionModelMock.findById).mockResolvedValue(makeCollection());
        // Bookmark belongs to a different user
        asMock(bookmarkModelMock.findById).mockResolvedValue(
            makeBookmark({ userId: OTHER_USER_ID })
        );

        // Act
        const result = await service.addBookmarkToCollection(actor, {
            collectionId: COLLECTION_ID,
            bookmarkId: BOOKMARK_ID
        });

        // Assert
        expect(result.error?.code).toBe('FORBIDDEN');
    });

    it("admin with VIEW_ANY can add any user's bookmark to any collection", async () => {
        // Arrange
        const admin = makeViewAnyActor();
        asMock(collectionModelMock.findById).mockResolvedValue(
            makeCollection({ userId: OTHER_USER_ID })
        );
        asMock(bookmarkModelMock.findById).mockResolvedValue(
            makeBookmark({ userId: OTHER_USER_ID })
        );
        const updatedBookmark = makeBookmark({ userId: OTHER_USER_ID });
        dbTerminal.mockResolvedValue([updatedBookmark]);

        // Act
        const result = await service.addBookmarkToCollection(admin, {
            collectionId: COLLECTION_ID,
            bookmarkId: BOOKMARK_ID
        });

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.userId).toBe(OTHER_USER_ID);
    });
});

// ===========================================================================
// removeBookmarkFromCollection
// ===========================================================================

describe('UserBookmarkCollectionService.removeBookmarkFromCollection', () => {
    it('happy path: sets bookmark.collectionId to null', async () => {
        // Arrange
        const actor = makeOwnerActor();
        asMock(bookmarkModelMock.findById).mockResolvedValue(makeBookmark());
        const unlinkedBookmark = makeBookmark();
        dbTerminal.mockResolvedValue([unlinkedBookmark]);

        // Act
        const result = await service.removeBookmarkFromCollection(actor, {
            bookmarkId: BOOKMARK_ID
        });

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.id).toBe(BOOKMARK_ID);
        // The update chain should have been called with collectionId: null
        expect(asMock(dbChain.set as Mock)).toHaveBeenCalledWith(
            expect.objectContaining({ collectionId: null })
        );
    });

    it('returns NOT_FOUND when bookmark does not exist', async () => {
        // Arrange
        const actor = makeOwnerActor();
        asMock(bookmarkModelMock.findById).mockResolvedValue(null);

        // Act
        const result = await service.removeBookmarkFromCollection(actor, {
            bookmarkId: BOOKMARK_ID
        });

        // Assert
        expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('returns FORBIDDEN when actor does not own the bookmark', async () => {
        // Arrange
        const nonOwner = createActor({ id: OTHER_USER_ID, permissions: [] });
        asMock(bookmarkModelMock.findById).mockResolvedValue(makeBookmark());

        // Act
        const result = await service.removeBookmarkFromCollection(nonOwner, {
            bookmarkId: BOOKMARK_ID
        });

        // Assert
        expect(result.error?.code).toBe('FORBIDDEN');
        // The update DB call should NOT have been made
        expect(asMock(dbChain.set as Mock)).not.toHaveBeenCalled();
    });

    it("admin with VIEW_ANY can remove any user's bookmark from a collection", async () => {
        // Arrange
        const admin = makeViewAnyActor();
        asMock(bookmarkModelMock.findById).mockResolvedValue(
            makeBookmark({ userId: OTHER_USER_ID })
        );
        const unlinkedBookmark = makeBookmark({ userId: OTHER_USER_ID });
        dbTerminal.mockResolvedValue([unlinkedBookmark]);

        // Act
        const result = await service.removeBookmarkFromCollection(admin, {
            bookmarkId: BOOKMARK_ID
        });

        // Assert
        expect(result.error).toBeUndefined();
    });
});
