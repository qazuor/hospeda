/**
 * Mock factory for the @repo/db module.
 *
 * Returns a Vitest-compatible mock object that replaces the real database
 * client and model classes during unit tests.  Import this from within a
 * `vi.mock('@repo/db', () => createDbMock())` factory.
 *
 * @module test/helpers/mocks/db-mock
 */

import { vi } from 'vitest';

/** Shared billing schema column-name stubs. */
export const billingAddonPurchasesCols = {
    id: 'id',
    customerId: 'customer_id',
    subscriptionId: 'subscription_id',
    addonSlug: 'addon_slug',
    status: 'status',
    purchasedAt: 'purchased_at',
    expiresAt: 'expires_at',
    canceledAt: 'canceled_at',
    paymentId: 'payment_id',
    limitAdjustments: 'limit_adjustments',
    entitlementAdjustments: 'entitlement_adjustments',
    promoCodeId: 'promo_code_id',
    metadata: 'metadata',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
} as const;

/** Shared billing notification log column-name stubs. */
export const billingNotificationLogsCols = {
    id: 'id',
    customerId: 'customer_id',
    eventType: 'event_type',
    channel: 'channel',
    status: 'status',
    metadata: 'metadata',
    createdAt: 'created_at'
} as const;

/**
 * Creates the full mock object for `@repo/db`.
 *
 * Call this inside a `vi.mock` factory function:
 * ```ts
 * vi.mock('@repo/db', () => createDbMock());
 * ```
 */
/**
 * Generic no-op model stub (SPEC-169 harness fix). Used for every @repo/db model that a
 * route's service instantiates at module scope but that does not need bespoke behavior in
 * route-level tests. Having all models present lets `initApp()` build the full app so route
 * tests can collect; tests that need real data mock the specific model/service themselves.
 */
class GenericMockModel {
    async findById(_id: string) {
        return null;
    }
    /**
     * HOS-321: catalog validation batches through `findByIds`. Without this the
     * junction sync throws `TypeError: findByIds is not a function` (a 500)
     * instead of the clean VALIDATION_ERROR 400 the route contract promises.
     */
    async findByIds(_ids: readonly string[]) {
        return [];
    }
    async findOne(_filters: unknown) {
        return null;
    }
    async findAll(_filters?: unknown) {
        return { items: [], total: 0 };
    }
    async findAllWithRelations(_relations: unknown, _where?: unknown) {
        return { items: [], total: 0 };
    }
    async create(_data: unknown) {
        return { id: 'generic_mock_id', createdAt: new Date() };
    }
    async update(_id: string, _data: unknown) {
        return { id: _id, updatedAt: new Date() };
    }
    async softDelete(_id: string) {
        return { id: _id, deletedAt: new Date() };
    }
    async restore(_id: string) {
        return { id: _id, deletedAt: null };
    }
    async hardDelete(_id: string) {
        return { id: _id };
    }
    async delete(_id: string) {
        return { id: _id, deletedAt: new Date() };
    }
    async count(_filters?: unknown) {
        return 0;
    }
    getTable() {
        return {};
    }
    getTableName() {
        return 'generic_mock_table';
    }
}

/**
 * Column map for the `gastronomies` table (SPEC-239), keyed by the camelCase Drizzle
 * property names → snake_case DB column names. Mirrors the `@repo/db/schemas` mock shape.
 *
 * `BaseCrudRead.adminList` validates the requested (or default) sort field against the
 * model's `getTable()` via `hasOwnProperty`, and checks `'deletedAt' in table` to decide
 * the soft-delete filter. A bare `{}` (as GenericMockModel returns) makes EVERY sort field —
 * including the `createdAt` default — fail with VALIDATION_ERROR (400). Returning the real
 * column set lets the admin list / options routes exercise the full handler path against the
 * mocked DB, so route-level tests assert true gate + routing behaviour instead of a spurious
 * 400 from the sort guard.
 */
const GASTRONOMY_TABLE_COLUMNS = {
    id: 'id',
    slug: 'slug',
    name: 'name',
    summary: 'summary',
    description: 'description',
    richDescription: 'rich_description',
    type: 'type',
    priceRange: 'price_range',
    menuUrl: 'menu_url',
    ownerId: 'owner_id',
    destinationId: 'destination_id',
    visibility: 'visibility',
    lifecycleState: 'lifecycle_state',
    moderationState: 'moderation_state',
    isFeatured: 'is_featured',
    reviewsCount: 'reviews_count',
    averageRating: 'average_rating',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    createdById: 'created_by_id',
    updatedById: 'updated_by_id',
    deletedAt: 'deleted_at',
    deletedById: 'deleted_by_id'
} as const;

/**
 * Gastronomy model stub that exposes the real column set via `getTable()` so the
 * (real) GastronomyService admin list/options/sort validation runs faithfully against
 * the mocked DB. All data methods stay no-op (inherited from GenericMockModel).
 */
class GastronomyMockModel extends GenericMockModel {
    override getTable() {
        return GASTRONOMY_TABLE_COLUMNS;
    }
    override getTableName() {
        return 'gastronomies';
    }
}

/**
 * Column map for the `experiences` table (SPEC-240), mirroring GASTRONOMY_TABLE_COLUMNS
 * with experience-specific additions. Needed so ExperienceService admin list/sort
 * validation runs faithfully against the mocked DB.
 */
const EXPERIENCE_TABLE_COLUMNS = {
    id: 'id',
    slug: 'slug',
    name: 'name',
    summary: 'summary',
    description: 'description',
    richDescription: 'rich_description',
    type: 'type',
    priceFrom: 'price_from',
    priceUnit: 'price_unit',
    isPriceOnRequest: 'is_price_on_request',
    ownerId: 'owner_id',
    destinationId: 'destination_id',
    visibility: 'visibility',
    lifecycleState: 'lifecycle_state',
    moderationState: 'moderation_state',
    isFeatured: 'is_featured',
    hasActiveSubscription: 'has_active_subscription',
    reviewsCount: 'reviews_count',
    averageRating: 'average_rating',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    createdById: 'created_by_id',
    updatedById: 'updated_by_id',
    deletedAt: 'deleted_at',
    deletedById: 'deleted_by_id'
} as const;

/**
 * Experience model stub (SPEC-240). Mirrors GastronomyMockModel so that
 * ExperienceService admin list/options/sort validation runs faithfully against
 * the mocked DB. Registered in createDbMock() as `experienceModel`.
 */
class ExperienceMockModel extends GenericMockModel {
    override getTable() {
        return EXPERIENCE_TABLE_COLUMNS;
    }
    override getTableName() {
        return 'experiences';
    }
}

/**
 * HOS-981 — `qr_codes` table stub.
 *
 * Shape-only, in the style of the `accommodations` stub further down: a map from
 * the property name production code uses to the physical column name, which is
 * everything `Object.hasOwn(table, col)` and `safeIlike(table[col], term)` need.
 *
 * Declared at module scope rather than inline because three exports have to
 * agree on the SAME object: `qrCodes` itself (imported at module scope by
 * `QrCodeService._buildSearchConditions`), `MockQrCodeModel.getTable()` — which
 * `adminList` calls to validate the sort field, and which throws
 * "Cannot convert undefined or null to object" when it answers `undefined` —
 * and `buildSearchCondition`.
 */
const qrCodesTableStub = {
    id: 'id',
    slug: 'slug',
    targetUrl: 'target_url',
    label: 'label',
    description: 'description',
    source: 'source',
    entityType: 'entity_type',
    entityId: 'entity_id',
    renderOptions: 'render_options',
    isActive: 'is_active',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    createdById: 'created_by_id',
    updatedById: 'updated_by_id',
    deletedAt: 'deleted_at',
    deletedById: 'deleted_by_id'
};

/** HOS-981 — `qr_code_scans` table stub. Append-only: three columns, no audit. */
const qrCodeScansTableStub = {
    id: 'id',
    qrCodeId: 'qr_code_id',
    scannedAt: 'scanned_at'
};

export function createDbMock() {
    return {
        // Database client
        getDb: vi.fn(() => ({
            /**
             * Makes the builder itself awaitable, resolving to an empty result
             * set (HOS-1072).
             *
             * Without it, awaiting a chain that does not end in `limit()` —
             * `select().from().innerJoin().where().orderBy()`, which is what a
             * catalog join looks like — handed the caller the BUILDER OBJECT.
             * The next line is invariably `rows.map(...)`, so the route threw
             * "rows.map is not a function" and the failure read as a broken
             * route rather than an unstubbed query. Chaining is unaffected:
             * every step still returns `this`, and `limit()` stays terminal.
             */
            // biome-ignore lint/suspicious/noThenProperty: a query builder that can be awaited is exactly what this stub must imitate.
            then: (
                onFulfilled?: ((value: unknown[]) => unknown) | null,
                onRejected?: ((reason: unknown) => unknown) | null
            ) => Promise.resolve([]).then(onFulfilled, onRejected),
            select: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            innerJoin: vi.fn().mockReturnThis(),
            leftJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            // Resolves to an empty result set, not to the chain itself. `limit()`
            // is terminal in this codebase and callers destructure it
            // (`const [row] = await ...limit(1)`); returning the builder made
            // that throw "is not iterable" before any assertion could run, which
            // reads as a broken suite rather than an unstubbed query. The
            // `withTransaction` stub below already resolved `[]` here — this is
            // the same fix, applied to the half that was missing it.
            limit: vi.fn().mockResolvedValue([]),
            orderBy: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue([]),
            insert: vi.fn().mockReturnThis(),
            values: vi.fn().mockReturnThis(),
            returning: vi.fn().mockResolvedValue([]),
            update: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
            query: {},
            transaction: vi.fn()
        })),
        initializeDb: vi.fn(),

        // safeIlike() escapes LIKE metacharacters; production code must never use
        // drizzle's raw ilike(). Shape-only stub: enough for a WHERE builder to
        // hold, and inspectable by tests that assert on the emitted condition.
        safeIlike: vi.fn((col: unknown, term: string) => ({
            type: 'safeIlike',
            col,
            term
        })),

        /**
         * Free-text search-condition builder used by `BaseCrudService.adminList`
         * and `search` (HOS-981).
         *
         * Shape-only, but it reproduces the ONE behaviour a caller can be wrong
         * about: a column the table does not carry is dropped SILENTLY, and an
         * empty result becomes `undefined` rather than an always-true clause. A
         * service that names a column it does not have therefore attaches NO
         * filter and answers `?search=anything` with the whole table — a bug
         * that looks like a search matching everything rather than one that ran
         * nothing, so a stub that always returned a condition would hide exactly
         * the failure worth catching.
         *
         * Absent until now, which meant the import resolved to `undefined` and
         * any admin list carrying a `search` term died with "is not a function".
         */
        buildSearchCondition: vi.fn((term: string, columns: readonly string[], table: unknown) => {
            if (!term || term.trim().length === 0) return undefined;
            if (typeof table !== 'object' || table === null) return undefined;

            const tableRecord = table as Record<string, unknown>;
            const conditions = columns
                .filter((col) => Object.hasOwn(tableRecord, col))
                .map((col) => ({ type: 'safeIlike', col: tableRecord[col], term: term.trim() }));

            if (conditions.length === 0) return undefined;
            if (conditions.length === 1) return conditions[0];
            return { type: 'or', conditions };
        }),

        /**
         * HOS-981 — `qr_codes` / `qr_code_scans` table stubs. `qrCodes` is
         * imported at module scope by `QrCodeService`, so its absence is not a
         * QR-only problem: it surfaces wherever the app is booted.
         */
        qrCodes: qrCodesTableStub,
        qrCodeScans: qrCodeScansTableStub,

        /**
         * Gastronomy catalog-membership clause builders (HOS-1054).
         *
         * This factory is an explicit INVENTORY of `@repo/db`'s surface, not a
         * passthrough, so any production import it does not name resolves to a
         * hard vitest error ("No <x> export is defined on the @repo/db mock")
         * the moment the importing line runs.
         *
         * That is not a cosmetic gap. `GastronomyService._executeCount` is on the
         * path the commerce limits middleware takes to count an owner's listings,
         * and since HOS-1078 that middleware fails CLOSED — so a missing export
         * here surfaces as a **503 on listing creation**, which reads as a broken
         * route rather than as an unstubbed helper. Same species of failure the
         * awaitable-builder note above documents.
         *
         * Shape-only stubs, mirroring `safeIlike`: enough for a WHERE builder to
         * hold, and inspectable by a test that asserts on the emitted condition.
         * `buildGastronomyCatalogConditions` reproduces the real contract that
         * matters to callers — an EMPTY array when no filter is active, so the
         * no-filter path (every limits-middleware count) stays identical to
         * before the filter existed.
         */
        buildGastronomyFeatureIntersectionClause: vi.fn((featureIds: readonly string[]) => ({
            type: 'gastronomyFeatureIntersection',
            featureIds
        })),
        buildGastronomyAmenityIntersectionClause: vi.fn((amenityIds: readonly string[]) => ({
            type: 'gastronomyAmenityIntersection',
            amenityIds
        })),
        buildGastronomyCatalogConditions: vi.fn(
            ({
                amenities,
                features
            }: {
                readonly amenities?: readonly string[];
                readonly features?: readonly string[];
            }) => {
                const conditions: unknown[] = [];
                if (amenities && amenities.length > 0) {
                    conditions.push({
                        type: 'gastronomyAmenityIntersection',
                        amenityIds: amenities
                    });
                }
                if (features && features.length > 0) {
                    conditions.push({
                        type: 'gastronomyFeatureIntersection',
                        featureIds: features
                    });
                }
                return conditions;
            }
        ),
        /**
         * Simulates withTransaction by executing the callback with a stub tx client.
         * The stub tx client supports the same chained query builder methods as getDb().
         * This allows withServiceTransaction (which calls withTransaction internally)
         * to work in unit tests without a real database connection.
         */
        withTransaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
            const txStub = {
                select: vi.fn().mockReturnThis(),
                from: vi.fn().mockReturnThis(),
                where: vi.fn().mockResolvedValue([]),
                innerJoin: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue([]),
                orderBy: vi.fn().mockReturnThis(),
                execute: vi.fn().mockResolvedValue(undefined),
                insert: vi.fn().mockReturnThis(),
                values: vi.fn().mockResolvedValue(undefined),
                returning: vi.fn().mockResolvedValue([]),
                update: vi.fn().mockReturnThis(),
                set: vi.fn().mockReturnThis(),
                delete: vi.fn().mockReturnThis()
            };
            return callback(txStub);
        }),

        // Re-export drizzle-orm operators (commonly used)
        sql: vi.fn(),
        eq: vi.fn((a: string, b: unknown) => ({ type: 'eq', left: a, right: b })),
        // HOS-1012 T-022: the trial supersede excludes the row being activated
        // with `ne(id, activatedId)`; without this export the whole webhook
        // activation path throws "No 'ne' export is defined on the @repo/db mock".
        ne: vi.fn((a: string, b: unknown) => ({ type: 'ne', left: a, right: b })),
        and: vi.fn((...args: unknown[]) => ({ type: 'and', conditions: args })),
        or: vi.fn((...args: unknown[]) => ({ type: 'or', conditions: args })),
        ilike: vi.fn((a: string, b: string) => ({ type: 'ilike', column: a, pattern: b })),
        desc: vi.fn((a: string) => ({ type: 'desc', column: a })),
        asc: vi.fn((a: string) => ({ type: 'asc', column: a })),
        count: vi.fn(),
        gte: vi.fn((a: string, b: unknown) => ({ type: 'gte', left: a, right: b })),
        lte: vi.fn((a: string, b: unknown) => ({ type: 'lte', left: a, right: b })),
        isNull: vi.fn((a: string) => ({ type: 'isNull', column: a })),
        isNotNull: vi.fn((a: string) => ({ type: 'isNotNull', column: a })),
        // HOS-934: hydrateSubscriptionProductDomains() batches its recovery
        // query with `inArray(billingSubscriptions.id, ids)`. Without this
        // export, any test that exercises the real (pass-through) hydration
        // helper throws "No 'inArray' export is defined on the @repo/db mock".
        inArray: vi.fn((a: string, b: readonly unknown[]) => ({
            type: 'inArray',
            column: a,
            values: b
        })),

        // Mock BaseModel class
        BaseModel: class MockBaseModel {
            public table = {};
            public entityName = 'mock';
            public getTableName() {
                return 'mock_table';
            }
        },

        // Mock UserModel
        UserModel: class MockUserModel {
            async findById(_id: string) {
                return null;
            }
            async findAll(_filters: unknown) {
                return { items: [], total: 0 };
            }
            async create(_data: unknown) {
                return { id: 'user_mock_id', email: 'mock@example.com', createdAt: new Date() };
            }
            async update(_id: string, _data: unknown) {
                return { id: _id, updatedAt: new Date() };
            }
            async delete(_id: string) {
                return { id: _id, deletedAt: new Date() };
            }
            async findByEmail(_email: string) {
                return null;
            }
            /**
             * HOS-375 T-012 — backs `UserService.listPublicAuthors`, which the
             * public `/api/v1/public/authors` route calls directly. The real
             * model returns `{ items: PublicAuthorListItem[], total: number }`
             * (see `packages/db/src/models/user/user.model.ts`); this mirrors
             * that shape field-for-field rather than the route's
             * `{ items, pagination }` envelope, since the ENVELOPE is built by
             * `UserService.listPublicAuthors` itself, one layer up from here.
             * A mock returning the wrong shape is exactly how the sibling
             * `events/author/:id` route stayed broken for months (see
             * `apps/api/test/routes/event/public/getByAuthor.test.ts`).
             */
            async listPublicAuthors(_options: { page: number; pageSize: number }) {
                return { items: [], total: 0 };
            }
        },

        // Mock AccommodationModel — instantiated at module scope in
        // routes/user/protected/reviews.ts, so it must exist on the mock or
        // initApp() fails to load (breaking collection for every route test).
        AccommodationModel: class MockAccommodationModel {
            async findById(_id: string) {
                return null;
            }
            async findByIds(_ids: readonly string[]) {
                return [];
            }
            async findAll(_filters: unknown) {
                return { items: [], total: 0 };
            }
        },

        // Mock AccommodationMediaModel (SPEC-204) — instantiated in the
        // AccommodationService constructor, so it must exist on the mock or
        // initApp() fails to load (breaking collection for every route test).
        AccommodationMediaModel: class MockAccommodationMediaModel {
            async findByAccommodation(_accommodationId: string) {
                return { items: [], total: 0 };
            }
            async findFeatured(_accommodationId: string) {
                return null;
            }
            async findByAccommodations(_input: unknown) {
                return new Map();
            }
            async create(_data: unknown, _tx?: unknown) {
                return null;
            }
            async hardDelete(_filters: unknown, _tx?: unknown) {
                return undefined;
            }
        },

        // HOS-390: relational content media, the post/event twins of
        // AccommodationMediaModel above. PostService and EventService instantiate
        // them in their constructors, so a mock without them fails at MODULE LOAD
        // for every test that touches a post or event route — and the suite then
        // reports "0 tests" rather than a failure, which reads like a pass.
        PostMediaModel: class MockPostMediaModel {
            async findByPost(_input: unknown) {
                return { items: [], total: 0 };
            }
            async findFeatured(_input: unknown) {
                return null;
            }
            async findByPosts(_input: unknown) {
                return new Map();
            }
            async findById(_id: string) {
                return null;
            }
            async findAll(_filters: unknown) {
                return { items: [], total: 0 };
            }
            async create(_data: unknown, _tx?: unknown) {
                return null;
            }
            async update(_filters: unknown, _data: unknown, _tx?: unknown) {
                return null;
            }
            async softDelete(_filters: unknown, _tx?: unknown) {
                return undefined;
            }
            async hardDelete(_filters: unknown, _tx?: unknown) {
                return undefined;
            }
        },

        EventMediaModel: class MockEventMediaModel {
            async findByEvent(_input: unknown) {
                return { items: [], total: 0 };
            }
            async findFeatured(_input: unknown) {
                return null;
            }
            async findByEvents(_input: unknown) {
                return new Map();
            }
            async findById(_id: string) {
                return null;
            }
            async findAll(_filters: unknown) {
                return { items: [], total: 0 };
            }
            async create(_data: unknown, _tx?: unknown) {
                return null;
            }
            async update(_filters: unknown, _data: unknown, _tx?: unknown) {
                return null;
            }
            async softDelete(_filters: unknown, _tx?: unknown) {
                return undefined;
            }
            async hardDelete(_filters: unknown, _tx?: unknown) {
                return undefined;
            }
        },

        // Mock DestinationModel — same module-scope instantiation in reviews.ts.
        DestinationModel: class MockDestinationModel {
            async findById(_id: string) {
                return null;
            }
            async findByIds(_ids: readonly string[]) {
                return [];
            }
            async findAll(_filters: unknown) {
                return { items: [], total: 0 };
            }
        },

        // Mock TagModel
        TagModel: class MockTagModel {
            async findById(_id: string) {
                return null;
            }
            async findAll(_filters: unknown) {
                return { items: [], total: 0 };
            }
            async findBySlug(_slug: string) {
                return null;
            }
            async create(_data: unknown) {
                return {
                    id: 'tag_mock_id',
                    name: 'Mock Tag',
                    slug: 'mock-tag',
                    createdAt: new Date()
                };
            }
            async update(_id: string, _data: unknown) {
                return { id: _id, updatedAt: new Date() };
            }
            async delete(_id: string) {
                return { id: _id, deletedAt: new Date() };
            }
        },

        /**
         * HOS-1057 — Mock ExperienceCertificateModel.
         *
         * This mock is an explicit INVENTORY: an export missing from it arrives
         * `undefined`, and the `new ExperienceCertificateModel()` inside the
         * service-core certificate helpers then throws at CALL time rather than
         * at import time — which reads as a broken handler instead of a missing
         * stub. Registered here so the certificate route tests exercise the real
         * chain up to the database and no further.
         */
        ExperienceCertificateModel: class MockExperienceCertificateModel {
            async findOne(_where: unknown) {
                return null;
            }
            async findById(_id: string) {
                return null;
            }
            async findAll(_filters: unknown) {
                return { items: [], total: 0 };
            }
            async count(_filters: unknown) {
                return 0;
            }
            async create(_data: unknown) {
                return { id: 'experience_certificate_mock_id', createdAt: new Date() };
            }
            async update(_id: string, _data: unknown) {
                return { id: _id, updatedAt: new Date() };
            }
        },

        /**
         * HOS-981 — Mock QrCodeModel.
         *
         * Needed by every `apps/api` test that boots the app, not just the QR
         * ones: `routes/index.ts` imports the public QR router, whose module
         * scope constructs a `QrCodeService`, whose constructor does
         * `new QrCodeModel()`. Without this entry that construction throws
         * `No "QrCodeModel" export is defined on the "@repo/db" mock` at import
         * time, so the failure lands on whichever unrelated route test happens
         * to pull the app in — which is why omitting it reddened all five unit
         * shards rather than one file.
         */
        QrCodeModel: class MockQrCodeModel {
            /**
             * `adminList` calls this to validate the requested sort field
             * against the real columns. Returning `undefined` makes
             * `Object.hasOwn(table, sortBy)` throw a bare TypeError that
             * surfaces as a 500 with no mention of the table — so the stub
             * answers with the same object `qrCodes` exports.
             */
            getTable() {
                return qrCodesTableStub;
            }
            async findOne(_where: unknown) {
                return null;
            }
            async findById(_id: string) {
                return null;
            }
            async findAll(_filters: unknown) {
                return { items: [], total: 0 };
            }
            async count(_filters: unknown) {
                return 0;
            }
            async create(_data: unknown) {
                return { id: 'qr_code_mock_id', createdAt: new Date() };
            }
            async update(_id: string, _data: unknown) {
                return { id: _id, updatedAt: new Date() };
            }
        },

        /**
         * HOS-981 — Mock QrCodeScanModel. Same construction path as
         * `QrCodeModel` above: the service instantiates both in its
         * constructor. Append-only, so it carries no soft-delete or audit
         * methods.
         */
        QrCodeScanModel: class MockQrCodeScanModel {
            async create(_data: unknown) {
                return { id: 'qr_code_scan_mock_id', scannedAt: new Date() };
            }
            async findAll(_filters: unknown) {
                return { items: [], total: 0 };
            }
            async count(_filters: unknown) {
                return 0;
            }
        },

        // Mock REntityTagModel
        REntityTagModel: class MockREntityTagModel {
            async findAll(_filters: unknown) {
                return { items: [], total: 0 };
            }
            async create(_data: unknown) {
                return { id: 'r_entity_tag_mock_id', createdAt: new Date() };
            }
            async delete(_id: string) {
                return { id: _id, deletedAt: new Date() };
            }
        },

        // SPEC-086 — Mock PostTagModel (separate subsystem from user-tags)
        PostTagModel: class MockPostTagModel {
            async findById(_id: string) {
                return null;
            }
            async findAll(_filters: unknown) {
                return { items: [], total: 0 };
            }
            async findBySlug(_slug: string) {
                return null;
            }
            async findActive() {
                return [];
            }
            async findActiveWithCounts() {
                return [];
            }
            async getImpactCount(_id: string) {
                return 0;
            }
            async create(_data: unknown) {
                return { id: 'post_tag_mock_id', createdAt: new Date() };
            }
            async update(_id: string, _data: unknown) {
                return { id: _id, updatedAt: new Date() };
            }
            async delete(_id: string) {
                return { id: _id };
            }
        },

        // SPEC-086 — Mock RPostPostTagModel (post→postTag join)
        RPostPostTagModel: class MockRPostPostTagModel {
            async setTagsForPost(_postId: string, _postTagIds: string[]) {
                return undefined;
            }
            async removeTagFromPost(_postId: string, _postTagId: string) {
                return undefined;
            }
            async findByPostId(_postId: string) {
                return [];
            }
            async findPostsByPostTagId(_postTagId: string) {
                return [];
            }
        },

        // Mock RRolePermissionModel (used by role-permissions-cache.ts)
        RRolePermissionModel: class MockRRolePermissionModel {
            async findAll(_filters: unknown, _opts?: unknown) {
                return { items: [], total: 0 };
            }
            async create(_data: unknown) {
                return { id: 'r_role_permission_mock_id', createdAt: new Date() };
            }
            async delete(_id: string) {
                return { id: _id, deletedAt: new Date() };
            }
        },

        // Mock RUserPermissionModel
        RUserPermissionModel: class MockRUserPermissionModel {
            async findAll(_filters: unknown, _opts?: unknown) {
                return { items: [], total: 0 };
            }
            async create(_data: unknown) {
                return { id: 'r_user_permission_mock_id', createdAt: new Date() };
            }
            async delete(_id: string) {
                return { id: _id, deletedAt: new Date() };
            }
        },

        // Mock CronRunModel (SPEC-161). Required so initApp() can construct the
        // cron service during route-test bootstrap; the methods are only exercised
        // by cron unit tests, so empty defaults are sufficient here.
        CronRunModel: class MockCronRunModel {
            async listRuns(_filters?: unknown, _opts?: unknown) {
                return { items: [], total: 0 };
            }
            async getLatestRunPerJob() {
                return [];
            }
            async getRecentFailures(_limit?: number) {
                return [];
            }
            async purgeOlderThan(_date: unknown) {
                return 0;
            }
            async findById(_id: string) {
                return null;
            }
            async findAll(_filters?: unknown) {
                return { items: [], total: 0 };
            }
            async create(_data: unknown) {
                return { id: 'cron_run_mock_id', createdAt: new Date() };
            }
        },

        // Mock UserBookmarkModel
        UserBookmarkModel: class MockUserBookmarkModel {
            async findById(_id: string) {
                return null;
            }
            async findAll(_filters: unknown) {
                return { items: [], total: 0 };
            }
            async create(_data: unknown) {
                return { id: 'user_bookmark_mock_id', createdAt: new Date() };
            }
            async delete(_id: string) {
                return { id: _id, deletedAt: new Date() };
            }
        },

        // Mock UserBookmarkCollectionModel
        UserBookmarkCollectionModel: class MockUserBookmarkCollectionModel {
            async findById(_id: string) {
                return null;
            }
            async findAll(_filters: unknown) {
                return { items: [], total: 0 };
            }
            async create(_data: unknown) {
                return { id: 'user_bookmark_collection_mock_id', createdAt: new Date() };
            }
            async update(_id: string, _data: unknown) {
                return { id: _id, updatedAt: new Date() };
            }
            async delete(_id: string) {
                return { id: _id, deletedAt: new Date() };
            }
        },

        // SPEC-289: UserSearchHistoryModel — instantiated at module scope in
        // routes/accommodation/public/list.ts (SearchHistoryService constructor).
        // Expose both a class (for new UserSearchHistoryModel()) and a singleton
        // (for the `userSearchHistoryModel` import) so initApp() loads cleanly.
        UserSearchHistoryModel: class MockUserSearchHistoryModel {
            async findById(_id: string) {
                return null;
            }
            async findAll(_filters: unknown, _pagination?: unknown) {
                return { items: [], total: 0 };
            }
            async create(_data: unknown, _tx?: unknown) {
                return { id: 'search_history_mock_id', createdAt: new Date() };
            }
            async hardDelete(_filters: unknown, _tx?: unknown) {
                return 0;
            }
            async count(_filters: unknown, _opts?: unknown) {
                return 0;
            }
            raw = vi.fn().mockResolvedValue(undefined);
        },
        userSearchHistoryModel: {
            findById: vi.fn().mockResolvedValue(null),
            findAll: vi.fn().mockResolvedValue({ items: [], total: 0 }),
            create: vi
                .fn()
                .mockResolvedValue({ id: 'search_history_mock_id', createdAt: new Date() }),
            hardDelete: vi.fn().mockResolvedValue(0),
            count: vi.fn().mockResolvedValue(0),
            raw: vi.fn().mockResolvedValue(undefined)
        },

        // Mock UserIdentityModel
        UserIdentityModel: class MockUserIdentityModel {
            async findById(_id: string) {
                return null;
            }
            async findAll(_filters: unknown) {
                return { items: [], total: 0 };
            }
        },

        // Mock ExchangeRateModel
        ExchangeRateModel: class MockExchangeRateModel {
            async create(_data: unknown) {
                return {
                    id: 'rate_mock_id',
                    fromCurrency: 'USD',
                    toCurrency: 'ARS',
                    rate: 1180.5,
                    inverseRate: 0.000847,
                    rateType: 'blue',
                    source: 'MANUAL',
                    isManualOverride: true,
                    fetchedAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
            }
            async findAll(_filters: unknown) {
                return { items: [], total: 0 };
            }
            async findById(_id: string) {
                return null;
            }
            async update(_id: string, _data: unknown) {
                return {
                    id: 'rate_mock_id',
                    fromCurrency: 'USD',
                    toCurrency: 'ARS',
                    rate: 1180.5,
                    inverseRate: 0.000847,
                    rateType: 'blue',
                    source: 'MANUAL',
                    isManualOverride: true,
                    fetchedAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
            }
            async delete(_id: string) {
                return { id: _id, deletedAt: new Date() };
            }
        },

        // Accommodation table stubs (SPEC-167 T-007: plan-restriction.service imports
        // accommodations.id / accommodations.deletedAt for inArray/isNull WHERE clauses)
        accommodations: {
            id: 'id',
            ownerId: 'owner_id',
            planRestricted: 'plan_restricted',
            ownerSuspended: 'owner_suspended',
            deletedAt: 'deleted_at',
            updatedAt: 'updated_at'
        },

        // SPEC-204 T-008: plan-photo-restriction.service dual-writes archive/restore
        // state into `accommodation_media` in the same transaction. Route tests that
        // load initApp() need this table stub present so the SUT import doesn't throw
        // "[vitest] No 'accommodationMedia' export is defined on the '@repo/db' mock".
        accommodationMedia: {
            accommodationId: 'accommodation_id',
            url: 'url',
            state: 'state',
            archivedAt: 'archived_at',
            isFeatured: 'is_featured',
            sortOrder: 'sort_order',
            updatedAt: 'updated_at',
            deletedAt: 'deleted_at'
        },

        // Owner promotions table stubs (SPEC-167 T-008: plan-restriction.service imports
        // ownerPromotions.id / ownerPromotions.deletedAt for inArray/isNull WHERE clauses)
        ownerPromotions: {
            id: 'id',
            ownerId: 'owner_id',
            planRestricted: 'plan_restricted',
            lifecycleState: 'lifecycle_state',
            deletedAt: 'deleted_at',
            updatedAt: 'updated_at'
        },

        // Billing schema stubs
        billingAddonPurchases: billingAddonPurchasesCols,
        billingNotificationLogs: billingNotificationLogsCols,
        billingAuditLogs: {
            action: 'action',
            entityType: 'entityType',
            entityId: 'entityId',
            actorId: 'actorId',
            metadata: 'metadata',
            livemode: 'livemode',
            createdAt: 'createdAt'
        },

        // Newsletter campaigns table stubs (SPEC-101 T-101-27)
        newsletterCampaigns: {
            id: 'id',
            title: 'title',
            subject: 'subject',
            bodyJson: 'body_json',
            status: 'status',
            localeFilter: 'locale_filter',
            totalRecipients: 'total_recipients',
            totalSoftcapped: 'total_softcapped',
            sentAt: 'sent_at',
            scheduledFor: 'scheduled_for',
            createdBy: 'created_by',
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            deletedAt: 'deleted_at'
        },

        // Subscription webhook processing stubs
        billingSubscriptions: {
            id: 'id',
            customerId: 'customer_id',
            planId: 'plan_id',
            status: 'status',
            billingInterval: 'billing_interval',
            currentPeriodStart: 'current_period_start',
            currentPeriodEnd: 'current_period_end',
            trialEnd: 'trial_end',
            productDomain: 'product_domain',
            mpSubscriptionId: 'mp_subscription_id',
            promoCodeId: 'promo_code_id',
            promoEffectRemainingCycles: 'promo_effect_remaining_cycles',
            cancelAtPeriodEnd: 'cancel_at_period_end',
            canceledAt: 'canceled_at',
            deletedAt: 'deleted_at',
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        },

        // Admin billing VIEW service (HOS-474) joins these four to turn qzpay's
        // customerId/planId into a user and a plan. They are imported at module
        // scope by the payments/subscriptions view routes, so EVERY test that
        // boots the API route tree resolves them through this mock — not only
        // the billing ones.
        billingPayments: {
            id: 'id',
            customerId: 'customer_id',
            subscriptionId: 'subscription_id',
            invoiceId: 'invoice_id',
            amount: 'amount',
            currency: 'currency',
            refundedAmount: 'refunded_amount',
            status: 'status',
            provider: 'provider',
            providerPaymentIds: 'provider_payment_ids',
            createdAt: 'created_at',
            deletedAt: 'deleted_at'
        },
        billingCustomers: {
            id: 'id',
            externalId: 'external_id',
            email: 'email',
            name: 'name',
            deletedAt: 'deleted_at'
        },

        // HOS-1084: the shared subscription-status cache. Imported at module
        // scope by `entity-subscription-cache.service.ts`, which the public
        // accommodation routes reach through `owner-entitlement.ts` — so every
        // test that boots the route tree resolves it through this mock.
        entitySubscriptions: {
            id: 'id',
            subscriptionId: 'subscription_id',
            productDomain: 'product_domain',
            entityType: 'entity_type',
            entityId: 'entity_id',
            status: 'status',
            planId: 'plan_id',
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        },
        ENTITY_SUBSCRIPTION_STATUS_NONE: 'none',
        billingPlans: {
            id: 'id',
            name: 'name',
            displayName: 'display_name',
            monthlyPriceArs: 'monthly_price_ars',
            annualPriceArs: 'annual_price_ars',
            productDomain: 'product_domain',
            deletedAt: 'deleted_at'
        },
        users: {
            id: 'id',
            email: 'email',
            displayName: 'display_name',
            firstName: 'first_name',
            lastName: 'last_name',
            deletedAt: 'deleted_at'
        },

        // Shared amenity/feature catalog and the commerce junction tables the
        // public detail routes join against (HOS-1072). Column-name stubs only:
        // this mock replaces the WHOLE `@repo/db` module, so a table it does not
        // name arrives as `undefined` and the first `eq(table.column, …)` throws
        // — which surfaces as a 500 from a route whose own logic is fine.
        amenities: {
            id: 'id',
            slug: 'slug',
            icon: 'icon',
            displayWeight: 'display_weight'
        },
        features: {
            id: 'id',
            slug: 'slug',
            icon: 'icon',
            displayWeight: 'display_weight'
        },
        rGastronomyAmenity: {
            gastronomyId: 'gastronomy_id',
            amenityId: 'amenity_id'
        },
        rGastronomyFeature: {
            gastronomyId: 'gastronomy_id',
            featureId: 'feature_id',
            hostReWriteName: 'host_rewrite_name',
            comments: 'comments'
        },
        rExperienceAmenity: {
            experienceId: 'experience_id',
            amenityId: 'amenity_id'
        },
        rExperienceFeature: {
            experienceId: 'experience_id',
            featureId: 'feature_id',
            hostReWriteName: 'host_rewrite_name',
            comments: 'comments'
        },

        // Promo code effect columns (HOS-75 T-022) — typed Drizzle columns as
        // of @qazuor/qzpay-drizzle 1.11.0.
        billingPromoCodes: {
            id: 'id',
            code: 'code',
            effectKind: 'effect_kind',
            valueKind: 'value_kind',
            value: 'value',
            durationCycles: 'duration_cycles',
            extraDays: 'extra_days'
        },
        billingSubscriptionEvents: {
            id: 'id',
            subscriptionId: 'subscription_id',
            eventType: 'event_type',
            previousStatus: 'previous_status',
            newStatus: 'new_status',
            triggerSource: 'trigger_source',
            providerEventId: 'provider_event_id',
            metadata: 'metadata',
            createdAt: 'created_at'
        },

        // Better Auth verifications table stub (SPEC-118 reset-password check).
        verifications: {
            id: 'id',
            identifier: 'identifier',
            value: 'value',
            expiresAt: 'expires_at',
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        },

        // SPEC-156 T-002 PlatformSettingsModel stub. Instantiated at module
        // scope by PlatformSettingsService when the public announcements
        // route loads, so a minimal class with no-op CRUD is enough — tests
        // that hit /api/v1/public/announcements with this mock will see empty
        // announcement lists.
        PlatformSettingsModel: class MockPlatformSettingsModel {
            async findByKey(_key: string) {
                return undefined;
            }
            async upsertByKey(key: string, value: unknown, actorId: string) {
                return {
                    key,
                    value,
                    updatedAt: new Date(),
                    updatedBy: actorId
                };
            }
        },

        // SPEC-156 T-001 platform_settings table stub.
        platformSettings: {
            key: 'key',
            value: 'value',
            updatedAt: 'updated_at',
            updatedBy: 'updated_by'
        },

        // SPEC-155 conversation models — instantiated at module scope by
        // ConversationService when conversation routes load. Minimal CRUD stubs so
        // initApp() can build the app for route-level tests (SPEC-169 harness fix).
        ConversationModel: class MockConversationModel {
            async findById(_id: string) {
                return null;
            }
            async findAll(_filters: unknown) {
                return { items: [], total: 0 };
            }
            async findOne(_filters: unknown) {
                return null;
            }
            async create(_data: unknown) {
                return { id: 'conversation_mock_id', createdAt: new Date() };
            }
            async update(_id: string, _data: unknown) {
                return { id: _id, updatedAt: new Date() };
            }
            async count(_filters: unknown) {
                return 0;
            }
        },
        MessageModel: class MockMessageModel {
            async findById(_id: string) {
                return null;
            }
            async findAll(_filters: unknown) {
                return { items: [], total: 0 };
            }
            async create(_data: unknown) {
                return { id: 'message_mock_id', createdAt: new Date() };
            }
            async count(_filters: unknown) {
                return 0;
            }
        },

        // SPEC-169 harness fix: remaining @repo/db models that are instantiated at module
        // scope when their routes load. They need no bespoke behavior for route-level tests,
        // so they share the GenericMockModel no-op stub. Keeping every model present lets
        // initApp() build the whole app (previously initApp threw on the first missing model,
        // so NO route test could collect).
        AccessTokenModel: GenericMockModel,
        AccommodationExternalListingModel: GenericMockModel,
        AccommodationExternalReputationModel: GenericMockModel,
        AccommodationFaqModel: GenericMockModel,
        AccommodationIaDataModel: GenericMockModel,
        AccommodationReviewModel: GenericMockModel,
        AmenityModel: GenericMockModel,
        AttractionModel: GenericMockModel,
        BillingAddonPurchaseModel: GenericMockModel,
        BillingDunningAttemptModel: GenericMockModel,
        BillingNotificationLogModel: GenericMockModel,
        BillingSettingsModel: GenericMockModel,
        BillingSubscriptionEventModel: GenericMockModel,
        DestinationFaqModel: GenericMockModel,
        DestinationReviewModel: GenericMockModel,
        EntityCommentModel: GenericMockModel,
        EventLocationModel: GenericMockModel,
        EventModel: GenericMockModel,
        EventOrganizerModel: GenericMockModel,
        ExchangeRateConfigModel: GenericMockModel,
        FeatureFlagModel: GenericMockModel,
        FeatureModel: GenericMockModel,
        HostTradeModel: GenericMockModel,
        NotificationScheduleModel: GenericMockModel,
        // HOS-278 §6.5: AllianceLeadService's constructor now also instantiates
        // PartnerModel (partner provisioning), so the whole alliance admin route
        // tree fails to load without it.
        PartnerModel: GenericMockModel,
        // HOS-377: PartnerMentionService is exported from the @repo/service-core
        // barrel, so EVERY test that imports anything from that package resolves
        // this model — not just the mentions tests. Omitting it failed 43 test
        // FILES at collection time across three shards, with zero failed
        // assertions, which is what that failure mode looks like from the
        // summary line.
        PartnerMentionModel: GenericMockModel,
        OwnerPromotionModel: GenericMockModel,
        // HOS-113 T-021: PointOfInterestService (+ its default related model)
        // is instantiated at module scope by the new public POI routes, same
        // collection-breaking risk as every other model in this block.
        // HOS-139: PointOfInterestService's constructor now also instantiates
        // PoiCategoryModel + RPoiCategoryModel (category filter/type sync), so
        // they must be mockable here too, or the POI route tree fails to load.
        PoiCategoryModel: GenericMockModel,
        PointOfInterestModel: GenericMockModel,
        PostModel: GenericMockModel,
        PostSponsorModel: GenericMockModel,
        PostSponsorshipModel: GenericMockModel,
        RAccommodationAmenityModel: GenericMockModel,
        RAccommodationFeatureModel: GenericMockModel,
        RDestinationAttractionModel: GenericMockModel,
        RDestinationPointOfInterestModel: GenericMockModel,
        RPoiCategoryModel: GenericMockModel,
        RevalidationConfigModel: GenericMockModel,
        RevalidationLogModel: GenericMockModel,
        SponsorshipLevelModel: GenericMockModel,
        SponsorshipModel: GenericMockModel,
        SponsorshipPackageModel: GenericMockModel,
        // Social automation models (SPEC-254). Route modules instantiate the
        // social services eagerly at import time, so the app cannot load under
        // the @repo/db mock unless every social model is a constructable stub.
        SocialAiRequestModel: GenericMockModel,
        SocialAssetModel: GenericMockModel,
        SocialAudienceModel: GenericMockModel,
        SocialAuditLogModel: GenericMockModel,
        SocialCampaignModel: GenericMockModel,
        SocialContentBatchModel: GenericMockModel,
        SocialHashtagModel: GenericMockModel,
        SocialHashtagSetModel: GenericMockModel,
        SocialPlatformFormatModel: GenericMockModel,
        SocialPlatformModel: GenericMockModel,
        SocialPostFooterModel: GenericMockModel,
        SocialPostHashtagModel: GenericMockModel,
        SocialPostMediaModel: GenericMockModel,
        SocialPostModel: GenericMockModel,
        SocialPostTargetMediaModel: GenericMockModel,
        SocialPostTargetModel: GenericMockModel,
        SocialPublishLogModel: GenericMockModel,
        SocialSettingModel: GenericMockModel,

        // SPEC-286 T-005: AlertSubscriptionService instantiates
        // `new TouristPriceAlertModel()` at construction time when the
        // price-alert route module is loaded, same collection-breaking risk
        // as the other eagerly-instantiated models above.
        TouristPriceAlertModel: GenericMockModel,

        // SPEC-159 T-011: EntityViewModel singleton. Required so EntityViewService can
        // instantiate at module scope when the service-core barrel is loaded by any job
        // that imports @repo/service-core. The instance is returned directly (not a class)
        // because entityViewModel is a singleton, not a constructor.
        // getRecentlyViewedByUser added SPEC-284 T-001 — RecommendationService default-
        // injects this singleton at module scope, same collection-breaking risk as above.
        entityViewModel: {
            insertView: vi.fn().mockResolvedValue({ id: 'ev_mock_id' }),
            getStatsForEntities: vi.fn().mockResolvedValue([]),
            purgeOlderThan: vi.fn().mockResolvedValue(0),
            getRecentlyViewedByUser: vi.fn().mockResolvedValue({ accommodationIds: [] })
        },

        // SPEC-284: accommodationModel/destinationModel/userBookmarkModel singleton
        // instances. RecommendationService default-injects all three at module scope
        // (`accommodationModel as defaultAccommodationModel`, etc. from '@repo/db'), so
        // once the service-core barrel re-exports RecommendationService (T-006), every
        // route/job test that mocks '@repo/db' loads this module transitively and needs
        // these exports to exist. Return shapes mirror the real model methods used:
        // findTopRated → Accommodation[]; findAllWithRelations/findAll → {items, total};
        // findByIds → T[].
        accommodationModel: {
            findTopRated: vi.fn().mockResolvedValue([]),
            findAllWithRelations: vi.fn().mockResolvedValue({ items: [], total: 0 })
        },
        destinationModel: {
            findByIds: vi.fn().mockResolvedValue([])
        },
        userBookmarkModel: {
            findAll: vi.fn().mockResolvedValue({ items: [], total: 0 })
        },

        // SPEC-243 T-011: UserPushTokenModel singleton. Required so UserService can
        // instantiate at module scope (pushTokenModel = userPushTokenModel) when the
        // service-core barrel is loaded by any route/job that imports it. Returned as
        // an instance (not a class) because userPushTokenModel is a singleton.
        userPushTokenModel: {
            upsertByToken: vi.fn().mockResolvedValue({ id: 'upt_mock_id' })
        },

        // SPEC-204 T-013/T-014: AccommodationMediaModel singleton. The relational
        // read hooks (_afterGetByField/_afterList/_afterSearch) and the admin/protected
        // media upload routes import this singleton at module scope and call
        // findByAccommodation/findByAccommodations. Exported as an instance (not a
        // class) because accommodationMediaModel is a singleton in @repo/db. Defaults
        // to an empty gallery; tests override per-case (e.g. the gallery-cap test).
        accommodationMediaModel: {
            findByAccommodation: vi.fn().mockResolvedValue({ items: [], total: 0 }),
            findByAccommodations: vi.fn().mockResolvedValue(new Map()),
            findFeatured: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(null),
            hardDelete: vi.fn().mockResolvedValue(undefined)
        },

        // HOS-390: relational content media singletons (post_media / event_media).
        postMediaModel: {
            findByPost: vi.fn().mockResolvedValue({ items: [], total: 0 }),
            findByPosts: vi.fn().mockResolvedValue(new Map()),
            findFeatured: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(null),
            hardDelete: vi.fn().mockResolvedValue(undefined)
        },
        eventMediaModel: {
            findByEvent: vi.fn().mockResolvedValue({ items: [], total: 0 }),
            findByEvents: vi.fn().mockResolvedValue(new Map()),
            findFeatured: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(null),
            hardDelete: vi.fn().mockResolvedValue(undefined)
        },

        // HOS-372: relational commerce media singletons, the gastronomy/experience
        // twins of accommodationMediaModel above. GastronomyService and
        // ExperienceService resolve them in their constructors
        // (`mediaModel ?? gastronomyMediaModel`), so a mock without them fails at
        // MODULE LOAD for every test that touches the commerce routes — the suite
        // reports "0 tests" rather than a failure, which reads like a pass.
        gastronomyMediaModel: {
            findByGastronomy: vi.fn().mockResolvedValue({ items: [], total: 0 }),
            findByGastronomies: vi.fn().mockResolvedValue(new Map()),
            findFeatured: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(null),
            hardDelete: vi.fn().mockResolvedValue(undefined)
        },
        experienceMediaModel: {
            findByExperience: vi.fn().mockResolvedValue({ items: [], total: 0 }),
            findByExperiences: vi.fn().mockResolvedValue(new Map()),
            findFeatured: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(null),
            hardDelete: vi.fn().mockResolvedValue(undefined)
        },

        // SPEC-239: Gastronomy singleton model instances. GastronomyService,
        // GastronomyReviewService, and the standalone FAQ helpers access these at module
        // scope (via service constructor or direct import). They are exported as singleton
        // instances (not classes) in @repo/db — mirror that here with GenericMockModel
        // instances so initApp() can construct all gastronomy routes without a real DB.
        gastronomyModel: new GastronomyMockModel(),
        gastronomyReviewModel: new GenericMockModel(),
        rGastronomyAmenityModel: new GenericMockModel(),
        rGastronomyFeatureModel: new GenericMockModel(),

        // GastronomyFaqModel is also exported as a class (used by gastronomy.faq.ts
        // helpers which accept a GastronomyModel instance and internally call a new
        // GastronomyFaqModel for FAQ CRUD). Expose both the class and singleton.
        GastronomyFaqModel: GenericMockModel,
        gastronomyFaqModel: new GenericMockModel(),

        // HOS-895: the carta. `gastronomy.menu.ts` constructs both of these
        // itself, exactly as the FAQ helper constructs `GastronomyFaqModel`, so
        // the CLASS has to be here or the menu routes throw "not a constructor"
        // at request time rather than failing a visible assertion. This object
        // is an explicit inventory of `@repo/db`: an export missing from it
        // arrives as `undefined`, not as an import error.
        GastronomyMenuSectionModel: GenericMockModel,
        gastronomyMenuSectionModel: new GenericMockModel(),
        GastronomyMenuItemModel: GenericMockModel,
        gastronomyMenuItemModel: new GenericMockModel(),

        // HOS-1042: the venue agenda. `gastronomy.events.ts` constructs the
        // CLASS itself, same as the carta above, so it has to be in this
        // inventory or `new GastronomyEventModel()` throws "not a constructor"
        // at request time instead of failing a visible assertion.
        GastronomyEventModel: GenericMockModel,
        gastronomyEventModel: new GenericMockModel(),

        // HOS-277: AllianceLeadModel — instantiated at module scope by
        // AllianceLeadService when the alliance lead routes load. A GenericMockModel
        // no-op stub is sufficient for route-level permission-gate tests (no real DB
        // data needed; the service layer is exercised via mock actor headers).
        AllianceLeadModel: GenericMockModel,

        // HOS-376: the benefit-usage + review half of the host-trade domain.
        // Their services construct these at module scope when the routes load,
        // and unlike HostTradeService they are NOT mocked in the service-core
        // mock — the real service code runs in route tests, which is the point.
        // (`HostTradeModel` is already declared further up.)
        HostTradeBenefitUsageModel: GenericMockModel,
        HostTradeReviewModel: GenericMockModel,
        HostTradeReviewReplyModel: GenericMockModel,

        // SPEC-240: Experience singleton model instances. ExperienceService,
        // ExperienceReviewService, and the standalone FAQ helpers access these at module
        // scope (via service constructor or direct import). They are exported as singleton
        // instances (not classes) in @repo/db — mirror that here so initApp() can
        // construct all experience routes without a real DB.
        experienceModel: new ExperienceMockModel(),
        experienceReviewModel: new GenericMockModel(),
        rExperienceAmenityModel: new GenericMockModel(),
        rExperienceFeatureModel: new GenericMockModel(),

        // ExperienceFaqModel is also exported as a class (used by experience.faq.ts
        // helpers which accept an ExperienceModel instance and internally call a new
        // ExperienceFaqModel for FAQ CRUD). Expose both the class and singleton.
        ExperienceFaqModel: GenericMockModel,
        experienceFaqModel: new GenericMockModel()
    };
}
