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

export function createDbMock() {
    return {
        // Database client
        getDb: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
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
            mpSubscriptionId: 'mp_subscription_id',
            cancelAtPeriodEnd: 'cancel_at_period_end',
            canceledAt: 'canceled_at',
            deletedAt: 'deleted_at',
            createdAt: 'created_at',
            updatedAt: 'updated_at'
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
        FeatureModel: GenericMockModel,
        HostTradeModel: GenericMockModel,
        NotificationScheduleModel: GenericMockModel,
        OwnerPromotionModel: GenericMockModel,
        PostModel: GenericMockModel,
        PostSponsorModel: GenericMockModel,
        PostSponsorshipModel: GenericMockModel,
        RAccommodationAmenityModel: GenericMockModel,
        RAccommodationFeatureModel: GenericMockModel,
        RDestinationAttractionModel: GenericMockModel,
        RevalidationConfigModel: GenericMockModel,
        RevalidationLogModel: GenericMockModel,
        SponsorshipLevelModel: GenericMockModel,
        SponsorshipModel: GenericMockModel,
        SponsorshipPackageModel: GenericMockModel,

        // SPEC-159 T-011: EntityViewModel singleton. Required so EntityViewService can
        // instantiate at module scope when the service-core barrel is loaded by any job
        // that imports @repo/service-core. The instance is returned directly (not a class)
        // because entityViewModel is a singleton, not a constructor.
        entityViewModel: {
            insertView: vi.fn().mockResolvedValue({ id: 'ev_mock_id' }),
            getStatsForEntities: vi.fn().mockResolvedValue([]),
            purgeOlderThan: vi.fn().mockResolvedValue(0)
        },

        // SPEC-239: Gastronomy singleton model instances. GastronomyService,
        // GastronomyReviewService, and the standalone FAQ helpers access these at module
        // scope (via service constructor or direct import). They are exported as singleton
        // instances (not classes) in @repo/db — mirror that here with GenericMockModel
        // instances so initApp() can construct all gastronomy routes without a real DB.
        gastronomyModel: new GenericMockModel(),
        gastronomyReviewModel: new GenericMockModel(),
        rGastronomyAmenityModel: new GenericMockModel(),
        rGastronomyFeatureModel: new GenericMockModel(),

        // GastronomyFaqModel is also exported as a class (used by gastronomy.faq.ts
        // helpers which accept a GastronomyModel instance and internally call a new
        // GastronomyFaqModel for FAQ CRUD). Expose both the class and singleton.
        GastronomyFaqModel: GenericMockModel,
        gastronomyFaqModel: new GenericMockModel(),

        // SPEC-239 T-047: CommerceLeadModel — instantiated at module scope by
        // CommerceLeadService when the commerce lead routes load. The GenericMockModel
        // no-op stub is sufficient for route-level permission-gate tests (no real DB
        // data needed; the service layer is exercised via mock actor headers).
        CommerceLeadModel: GenericMockModel
    };
}
