import { PermissionEnum, RoleEnum, ServiceErrorCode, VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createErrorHandler } from '../../src/middlewares/response';
import { createUserBookmarkRoute } from '../../src/routes/user-bookmark/protected/create';
import { addBookmarkToCollectionRoute } from '../../src/routes/user-bookmark-collection/protected/addBookmark';
import { createUserBookmarkCollectionRoute } from '../../src/routes/user-bookmark-collection/protected/create';
import { deleteUserBookmarkCollectionRoute } from '../../src/routes/user-bookmark-collection/protected/delete';
import { getUserBookmarkCollectionByIdRoute } from '../../src/routes/user-bookmark-collection/protected/getById';
import { listUserBookmarkCollectionsRoute } from '../../src/routes/user-bookmark-collection/protected/list';
import { removeBookmarkFromCollectionRoute } from '../../src/routes/user-bookmark-collection/protected/removeBookmark';
import { updateUserBookmarkCollectionRoute } from '../../src/routes/user-bookmark-collection/protected/update';
import type { AppBindings } from '../../src/types';
import { createGuestActor } from '../../src/utils/actor';

const IDS = {
    vip: '11111111-1111-4111-8111-111111111111',
    floor: '22222222-2222-4222-8222-222222222222',
    empty: '33333333-3333-4333-8333-333333333333',
    collection: '44444444-4444-4444-8444-444444444444',
    bookmark: '55555555-5555-4555-8555-555555555555',
    entity: '66666666-6666-4666-8666-666666666666'
} as const;
const mocks = vi.hoisted(() => ({
    effectiveSet: vi.fn(),
    bookmarkFind: vi.fn(),
    bookmarkDelete: vi.fn(),
    bookmarkCreate: vi.fn(),
    bookmarkCount: vi.fn(),
    collectionCount: vi.fn(),
    collectionCreate: vi.fn(),
    collectionList: vi.fn(),
    collectionGet: vi.fn(),
    collectionUpdate: vi.fn(),
    collectionDelete: vi.fn(),
    collectionAdd: vi.fn(),
    collectionRemove: vi.fn()
}));
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        UserBookmarkService: class {
            findExistingBookmark = mocks.bookmarkFind;
            softDelete = mocks.bookmarkDelete;
            create = mocks.bookmarkCreate;
            countBookmarksForUser = mocks.bookmarkCount;
        },
        UserBookmarkCollectionService: class {
            countActiveCollections = mocks.collectionCount;
            createCollection = mocks.collectionCreate;
            listCollectionsByUser = mocks.collectionList;
            getCollectionById = mocks.collectionGet;
            updateCollection = mocks.collectionUpdate;
            deleteCollection = mocks.collectionDelete;
            addBookmarkToCollection = mocks.collectionAdd;
            removeBookmarkFromCollection = mocks.collectionRemove;
        }
    };
});
vi.mock('../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({ effectiveSet: mocks.effectiveSet })
}));
vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}));

const headers = {
    'content-type': 'application/json',
    'user-agent': 'vitest',
    accept: 'application/json'
};
const grants = {
    [IDS.vip]: [
        ['save_favorites', 1],
        ['max_favorites', 2147483647],
        ['can_use_collections', 1],
        ['max_collections', 25]
    ],
    [IDS.floor]: [
        ['save_favorites', 1],
        ['max_favorites', 5]
    ],
    [IDS.empty]: []
} as const;
function makeApp(route: Hono<AppBindings>, userId: string | null): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.onError(createErrorHandler());
    app.use((ctx, next) => {
        ctx.set(
            'actor',
            userId
                ? {
                      id: userId,
                      roles: [RoleEnum.USER],
                      permissions: Object.values(PermissionEnum),
                      emailVerified: true
                  }
                : createGuestActor()
        );
        return next();
    });
    app.route('/case', route);
    return app;
}
async function request(
    route: Hono<AppBindings>,
    userId: string | null,
    method: string,
    path: string,
    body?: unknown
) {
    return makeApp(route, userId).request(path, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
}
function gateEntries(userId: string, vertical: VerticalEnum) {
    return rehydrateEffectiveSet({
        version: 1,
        userId,
        vertical,
        hasLiveNonTrialTitle: false,
        inheritsTouristVip: false,
        entries: (grants[userId as keyof typeof grants] ?? []).map(([key, value]) => ({
            key,
            value,
            strategy: 'MAX' as const
        }))
    });
}
const collection = {
    id: IDS.collection,
    userId: IDS.vip,
    name: 'Trips',
    description: null,
    color: null,
    icon: null,
    lifecycleState: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdById: null,
    updatedById: null,
    deletedById: null,
    adminInfo: null
};
const collectionBookmark = {
    id: IDS.bookmark,
    userId: IDS.vip,
    entityId: IDS.entity,
    entityType: 'ACCOMMODATION',
    collectionId: IDS.collection,
    name: null,
    description: null,
    lifecycleState: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdById: null,
    updatedById: null,
    deletedById: null,
    adminInfo: null
};

beforeEach(() => {
    vi.clearAllMocks();
    mocks.effectiveSet.mockImplementation(
        async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
            gateEntries(userId, vertical)
    );
    mocks.bookmarkFind.mockResolvedValue({ data: null });
    mocks.bookmarkDelete.mockResolvedValue({ data: { id: IDS.bookmark } });
    mocks.bookmarkCreate.mockResolvedValue({
        data: {
            id: IDS.bookmark,
            userId: IDS.vip,
            entityId: IDS.entity,
            entityType: 'ACCOMMODATION',
            collectionId: null,
            name: null,
            description: null,
            lifecycleState: 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            createdById: null,
            updatedById: null,
            deletedById: null,
            adminInfo: null
        }
    });
    mocks.bookmarkCount.mockResolvedValue({ data: { count: 0 } });
    mocks.collectionCount.mockResolvedValue({ data: { count: 0 } });
    mocks.collectionCreate.mockResolvedValue({ data: collection });
    mocks.collectionList.mockResolvedValue({ data: { rows: [], total: 0 } });
    mocks.collectionGet.mockResolvedValue({
        data: { collection, bookmarks: { rows: [], total: 0, page: 1, pageSize: 20 } }
    });
    mocks.collectionUpdate.mockResolvedValue({ data: collection });
    mocks.collectionDelete.mockResolvedValue({
        data: { id: IDS.collection, nullifiedBookmarks: 0 }
    });
    mocks.collectionAdd.mockResolvedValue({ data: collectionBookmark });
    mocks.collectionRemove.mockResolvedValue({ data: collectionBookmark });
});

describe('TEST:V5:33 favorites and collections gates', () => {
    it('gates bookmark toggle in both directions and checks only toggle-on quota', async () => {
        mocks.bookmarkFind.mockResolvedValue({ data: null });
        let response = await request(createUserBookmarkRoute, IDS.empty, 'POST', '/case', {
            entityId: IDS.entity,
            entityType: 'ACCOMMODATION'
        });
        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({
            error: {
                code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
                details: { entitlementKey: 'save_favorites' }
            }
        });
        expect(mocks.bookmarkCreate).not.toHaveBeenCalled();
        expect(mocks.bookmarkFind).not.toHaveBeenCalled();
        mocks.bookmarkFind.mockResolvedValue({ data: { id: IDS.bookmark } });
        response = await request(createUserBookmarkRoute, IDS.empty, 'POST', '/case', {
            entityId: IDS.entity,
            entityType: 'ACCOMMODATION'
        });
        expect(response.status).toBe(403);
        expect(mocks.bookmarkDelete).not.toHaveBeenCalled();

        mocks.bookmarkFind.mockResolvedValue({ data: { id: IDS.bookmark } });
        response = await request(createUserBookmarkRoute, IDS.floor, 'POST', '/case', {
            entityId: IDS.entity,
            entityType: 'ACCOMMODATION'
        });
        expect([200, 201]).toContain(response.status);
        expect(mocks.bookmarkCount).not.toHaveBeenCalled();
        mocks.bookmarkFind.mockResolvedValue({ data: null });
        mocks.bookmarkCount.mockResolvedValue({ data: { count: 5 } });
        response = await request(createUserBookmarkRoute, IDS.floor, 'POST', '/case', {
            entityId: IDS.entity,
            entityType: 'ACCOMMODATION'
        });
        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({
            error: {
                code: ServiceErrorCode.LIMIT_REACHED,
                details: { limitKey: 'max_favorites', currentCount: 5, maxAllowed: 5 }
            }
        });
        expect(mocks.bookmarkCreate).not.toHaveBeenCalled();
        mocks.bookmarkCount.mockResolvedValue({ data: { count: 0 } });
        response = await request(createUserBookmarkRoute, IDS.vip, 'POST', '/case', {
            entityId: IDS.entity,
            entityType: 'ACCOMMODATION'
        });
        expect([200, 201]).toContain(response.status);
        expect(mocks.effectiveSet).toHaveBeenCalledWith({
            userId: IDS.vip,
            vertical: VerticalEnum.TOURIST
        });
    });

    it('fails closed on unavailable bookmark counts and keeps auth and shape ahead of gates', async () => {
        mocks.bookmarkCount.mockRejectedValue(new Error('count unavailable'));
        const failedCount = await request(createUserBookmarkRoute, IDS.floor, 'POST', '/case', {
            entityId: IDS.entity,
            entityType: 'ACCOMMODATION'
        });
        expect(failedCount.status).toBe(503);
        expect(await failedCount.json()).toMatchObject({
            error: { code: ServiceErrorCode.SERVICE_UNAVAILABLE }
        });
        expect(mocks.bookmarkCreate).not.toHaveBeenCalled();

        vi.clearAllMocks();
        const guest = await request(createUserBookmarkRoute, null, 'POST', '/case', {
            entityId: IDS.entity,
            entityType: 'ACCOMMODATION'
        });
        expect(guest.status).toBe(401);
        expect(mocks.effectiveSet).not.toHaveBeenCalled();
        const invalid = await request(createUserBookmarkRoute, IDS.vip, 'POST', '/case', {
            entityId: 'invalid',
            entityType: 'ACCOMMODATION'
        });
        expect(invalid.status).toBe(400);
        expect(mocks.effectiveSet).not.toHaveBeenCalled();
    });

    it('requires collection capability on all seven routes and queries the actor tourist set', async () => {
        const cases = [
            [
                createUserBookmarkCollectionRoute,
                'POST',
                '/case',
                { name: 'Trips' },
                mocks.collectionCreate
            ],
            [listUserBookmarkCollectionsRoute, 'GET', '/case', undefined, mocks.collectionList],
            [
                getUserBookmarkCollectionByIdRoute,
                'GET',
                `/case/${IDS.collection}`,
                undefined,
                mocks.collectionGet
            ],
            [
                updateUserBookmarkCollectionRoute,
                'PATCH',
                `/case/${IDS.collection}`,
                { name: 'New trips' },
                mocks.collectionUpdate
            ],
            [
                deleteUserBookmarkCollectionRoute,
                'DELETE',
                `/case/${IDS.collection}`,
                undefined,
                mocks.collectionDelete
            ],
            [
                addBookmarkToCollectionRoute,
                'POST',
                `/case/${IDS.collection}/bookmarks/${IDS.bookmark}`,
                undefined,
                mocks.collectionAdd
            ],
            [
                removeBookmarkFromCollectionRoute,
                'DELETE',
                `/case/${IDS.collection}/bookmarks/${IDS.bookmark}`,
                undefined,
                mocks.collectionRemove
            ]
        ] as const;
        for (const [route, method, path, body, writer] of cases) {
            const response = await request(route, IDS.floor, method, path, body);
            expect(response.status, `${method} ${path}`).toBe(403);
            expect(await response.json()).toMatchObject({
                error: {
                    code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
                    details: { entitlementKey: 'can_use_collections' }
                }
            });
            if (route === getUserBookmarkCollectionByIdRoute) {
                expect(mocks.collectionGet).toHaveBeenCalled();
            } else {
                expect(writer).not.toHaveBeenCalled();
            }
        }
        for (const [route, method, path, body, service] of cases) {
            const response = await request(route, IDS.vip, method, path, body);
            expect(mocks.effectiveSet).toHaveBeenLastCalledWith({
                userId: IDS.vip,
                vertical: VerticalEnum.TOURIST
            });
            expect(service).toHaveBeenCalled();
            expect([200, 201], `${method} ${path}`).toContain(response.status);
        }
    });

    it('preserves existence ordering and enforces collection quotas and effective usage limits', async () => {
        const malformedId = await request(
            getUserBookmarkCollectionByIdRoute,
            IDS.vip,
            'GET',
            '/case/not-a-uuid'
        );
        expect(malformedId.status).toBe(400);
        expect(mocks.effectiveSet).not.toHaveBeenCalled();
        for (const [route, method, path, body, mutation] of [
            [
                getUserBookmarkCollectionByIdRoute,
                'GET',
                `/case/${IDS.collection}`,
                undefined,
                mocks.collectionUpdate
            ],
            [
                updateUserBookmarkCollectionRoute,
                'PATCH',
                `/case/${IDS.collection}`,
                { name: 'Changed' },
                mocks.collectionUpdate
            ],
            [
                deleteUserBookmarkCollectionRoute,
                'DELETE',
                `/case/${IDS.collection}`,
                undefined,
                mocks.collectionDelete
            ],
            [
                addBookmarkToCollectionRoute,
                'POST',
                `/case/${IDS.collection}/bookmarks/${IDS.bookmark}`,
                undefined,
                mocks.collectionAdd
            ]
        ] as const) {
            vi.clearAllMocks();
            mocks.effectiveSet.mockImplementation(
                async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
                    gateEntries(userId, vertical)
            );
            mocks.collectionGet.mockResolvedValue({
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'not found' }
            });
            const response = await request(route, IDS.floor, method, path, body);
            expect(response.status).toBe(404);
            expect(mocks.effectiveSet).not.toHaveBeenCalled();
            expect(mutation).not.toHaveBeenCalled();
        }

        const effectiveWithCollectionLimit =
            (max: number) =>
            async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
                rehydrateEffectiveSet({
                    version: 1,
                    userId,
                    vertical,
                    hasLiveNonTrialTitle: false,
                    inheritsTouristVip: false,
                    entries: [
                        { key: 'can_use_collections', value: 1, strategy: 'MAX' as const },
                        { key: 'max_collections', value: max, strategy: 'MAX' as const }
                    ]
                });

        vi.clearAllMocks();
        mocks.effectiveSet.mockImplementation(
            async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
                gateEntries(userId, vertical)
        );
        mocks.collectionCount.mockResolvedValue({ data: { count: 25 } });
        let response = await request(createUserBookmarkCollectionRoute, IDS.vip, 'POST', '/case', {
            name: 'At cap'
        });
        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({
            error: {
                code: ServiceErrorCode.LIMIT_REACHED,
                details: { limitKey: 'max_collections', currentCount: 25, maxAllowed: 25 }
            }
        });
        expect(mocks.collectionCreate).not.toHaveBeenCalled();

        vi.clearAllMocks();
        mocks.effectiveSet.mockImplementation(effectiveWithCollectionLimit(10));
        mocks.collectionCount.mockResolvedValue({
            error: { code: ServiceErrorCode.SERVICE_UNAVAILABLE, message: 'unavailable' }
        });
        response = await request(createUserBookmarkCollectionRoute, IDS.vip, 'POST', '/case', {
            name: 'Count failed'
        });
        expect(response.status).toBe(503);
        expect(mocks.collectionCreate).not.toHaveBeenCalled();

        vi.clearAllMocks();
        mocks.effectiveSet.mockImplementation(effectiveWithCollectionLimit(10));
        mocks.collectionCount.mockResolvedValue({ data: { count: 0 } });
        response = await request(createUserBookmarkCollectionRoute, IDS.vip, 'POST', '/case', {
            name: 'Ten cap'
        });
        expect([200, 201]).toContain(response.status);
        expect(mocks.collectionCreate).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
            hookState: { planLimit: 10 }
        });

        vi.clearAllMocks();
        mocks.effectiveSet.mockImplementation(effectiveWithCollectionLimit(10));
        mocks.collectionCount.mockResolvedValue({ data: { count: 0 } });
        mocks.collectionCreate.mockResolvedValue({
            error: {
                code: ServiceErrorCode.QUOTA_EXCEEDED,
                message: 'quota reached',
                details: { currentCount: 4, maxAllowed: 10 }
            }
        });
        response = await request(createUserBookmarkCollectionRoute, IDS.vip, 'POST', '/case', {
            name: 'Service quota'
        });
        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({
            error: {
                code: ServiceErrorCode.LIMIT_REACHED,
                details: { limitKey: 'max_collections', currentCount: 4, maxAllowed: 10 }
            }
        });

        for (const max of [10, 25]) {
            vi.clearAllMocks();
            mocks.effectiveSet.mockImplementation(effectiveWithCollectionLimit(max));
            mocks.collectionList.mockResolvedValue({ data: { rows: [], total: 0 } });
            response = await request(listUserBookmarkCollectionsRoute, IDS.vip, 'GET', '/case');
            expect(response.status).toBe(200);
            expect((await response.json()).data.usage.max).toBe(max);
        }
        vi.clearAllMocks();
        mocks.effectiveSet.mockImplementation(effectiveWithCollectionLimit(0));
        response = await request(listUserBookmarkCollectionsRoute, IDS.vip, 'GET', '/case');
        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({
            error: {
                code: ServiceErrorCode.LIMIT_REACHED,
                details: { limitKey: 'max_collections', maxAllowed: 0 }
            }
        });
        expect(mocks.collectionList).not.toHaveBeenCalled();
    });
});
