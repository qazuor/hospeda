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
            previousStatus: 'previous_status',
            newStatus: 'new_status',
            triggerSource: 'trigger_source',
            providerEventId: 'provider_event_id',
            metadata: 'metadata',
            createdAt: 'created_at'
        }
    };
}
