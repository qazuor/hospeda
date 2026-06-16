/**
 * SPEC-239 T-051 — Entitlement-engine isolation regression tests.
 *
 * Verifies that the accommodation entitlement engine is fully isolated from
 * commerce subscriptions.  The `isAccommodationSubscription` predicate is the
 * single choke-point for this isolation and is tested exhaustively here.
 *
 * Additionally verifies the integration-level contract via the subscription
 * `.find()` call in `parseMetadataAddons` / `queryUserAddons`:
 *
 *  - A customer with BOTH an active accommodation sub AND an active commerce sub
 *    resolves addon-metadata identically to one with ONLY the accommodation sub.
 *  - A customer whose ONLY sub is a commerce sub sees NO addon metadata.
 *  - Legacy rows (null / undefined productDomain) are treated as 'accommodation'.
 *
 * No DB, no network — all mocked.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared before module imports
// ---------------------------------------------------------------------------

const { mockGetDb } = vi.hoisted(() => ({ mockGetDb: vi.fn() }));

vi.mock('@repo/db', () => ({ getDb: mockGetDb }));

vi.mock('@repo/db/schemas', () => ({
    billingAddonPurchases: {
        id: 'id',
        customerId: 'customerId',
        addonSlug: 'addonSlug',
        status: 'status',
        purchasedAt: 'purchasedAt',
        expiresAt: 'expiresAt',
        canceledAt: 'canceledAt',
        deletedAt: 'deletedAt',
        updatedAt: 'updatedAt',
        limitAdjustments: 'limitAdjustments',
        entitlementAdjustments: 'entitlementAdjustments'
    }
}));

vi.mock('drizzle-orm', () => ({
    and: vi.fn((...args: unknown[]) => args),
    eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
    isNull: vi.fn((col: unknown) => ({ col, isNull: true }))
}));

// AddonCatalogService: return null for every slug (we only need the find() behaviour,
// not the catalog content, for these regression tests)
vi.mock('../../src/services/billing/addon/addon-catalog.service.js', () => ({
    AddonCatalogService: vi.fn().mockImplementation(() => ({
        getBySlug: vi.fn().mockResolvedValue({ success: false, error: { code: 'NOT_FOUND' } })
    }))
}));

import { queryUserAddons } from '../../src/services/billing/addon/addon-user-addons.js';
import { isAccommodationSubscription } from '../../src/services/billing/subscription/subscription-product-domain.js';

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

/**
 * Builds a Drizzle mock client whose select chain returns the given rows.
 * Used to simulate `billing_addon_purchases` DB queries returning no rows,
 * so the only addon source is metadata parsed from the subscription.
 */
function buildSelectMock(rows: unknown[] = []) {
    return {
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(rows)
            })
        })
    };
}

/** A synthetic billing subscription object with optional productDomain. */
interface StubSubscription {
    id: string;
    status: 'active' | 'trialing' | 'cancelled' | 'past_due';
    productDomain?: 'accommodation' | 'commerce' | null;
    metadata?: Record<string, unknown>;
}

/**
 * Builds a minimal billing client that returns the given subscriptions from
 * `subscriptions.getByCustomerId()`.  Customer always resolves to
 * `{ id: 'cust-1', email: 'host@test.com' }`.
 */
function buildBillingClient(subscriptions: StubSubscription[]) {
    return {
        customers: {
            getByExternalId: vi.fn().mockResolvedValue({ id: 'cust-1', email: 'host@test.com' })
        },
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue(subscriptions)
        }
    };
}

/**
 * A subscription with addon metadata embedded. The metadata key used by
 * `parseMetadataAddons` is `addonAdjustments` (JSON-stringified array).
 */
function withAddonMetadata(sub: StubSubscription, addonSlug: string): StubSubscription {
    return {
        ...sub,
        metadata: {
            addonAdjustments: JSON.stringify([
                {
                    addonSlug,
                    appliedAt: '2025-01-01T00:00:00.000Z',
                    limitKey: null,
                    limitIncrease: null,
                    entitlement: null
                }
            ])
        }
    };
}

// ---------------------------------------------------------------------------
// 1 — Unit tests for `isAccommodationSubscription` (the predicate itself)
// ---------------------------------------------------------------------------

describe('SPEC-239 T-051: isAccommodationSubscription predicate', () => {
    it('should return true when productDomain is undefined (column not in SELECT)', () => {
        expect(isAccommodationSubscription({ id: 'sub-1', status: 'active' })).toBe(true);
    });

    it('should return true when productDomain is null (legacy row, column exists)', () => {
        expect(
            isAccommodationSubscription({ id: 'sub-1', status: 'active', productDomain: null })
        ).toBe(true);
    });

    it('should return true when productDomain is explicitly "accommodation"', () => {
        expect(
            isAccommodationSubscription({
                id: 'sub-1',
                status: 'active',
                productDomain: 'accommodation'
            })
        ).toBe(true);
    });

    it('should return FALSE when productDomain is "commerce"', () => {
        expect(
            isAccommodationSubscription({
                id: 'sub-1',
                status: 'active',
                productDomain: 'commerce'
            })
        ).toBe(false);
    });

    it('should return true for an unknown future domain value (fail-open)', () => {
        // Any value that is not 'commerce' is treated as accommodation to avoid
        // accidentally dropping real accommodation subscriptions when new domains
        // are added.
        expect(
            isAccommodationSubscription({
                id: 'sub-1',
                status: 'active',
                productDomain: 'future_domain'
            })
        ).toBe(true);
    });

    it('should return true for a non-object primitive (defensive — should never happen)', () => {
        // The function casts to Record<string, unknown>; primitives have no
        // productDomain property → undefined → treated as accommodation.
        expect(isAccommodationSubscription(null)).toBe(true);
        expect(isAccommodationSubscription(undefined)).toBe(true);
        expect(isAccommodationSubscription(42)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// 2 — Integration contract via queryUserAddons:
//     parseMetadataAddons() must only look at accommodation-domain subs.
// ---------------------------------------------------------------------------

describe('SPEC-239 T-051: queryUserAddons — accommodation entitlement isolation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: DB returns no addon purchases so all addons come from metadata.
        mockGetDb.mockReturnValue(buildSelectMock([]));
    });

    it('customer with ONLY accommodation sub resolves addon metadata ' +
        '(baseline — no commerce sub present)', async () => {
        // Arrange
        const accommodationSub = withAddonMetadata(
            { id: 'sub-acc', status: 'active', productDomain: 'accommodation' },
            'extra-photos'
        );
        const billing = buildBillingClient([accommodationSub]);

        // Act
        const result = await queryUserAddons({
            billing: billing as never,
            userId: 'user-host-1'
        });

        // Assert
        expect(result.success).toBe(true);
        if (!result.success) throw new Error('unreachable');
        // Addon metadata was parsed from the accommodation sub.
        expect(result.data.some((a) => a.addonSlug === 'extra-photos')).toBe(true);
    });

    it('customer with BOTH accommodation and commerce subs resolves addon metadata ' +
        'identically to having ONLY the accommodation sub (the commerce sub is invisible)', async () => {
        // Arrange — accommodation sub has addon metadata; commerce sub has none.
        const accommodationSub = withAddonMetadata(
            { id: 'sub-acc', status: 'active', productDomain: 'accommodation' },
            'extra-photos'
        );
        const commerceSub: StubSubscription = {
            id: 'sub-com',
            status: 'active',
            productDomain: 'commerce',
            // Commerce sub also carries metadata — the engine must NOT read it.
            metadata: {
                addonAdjustments: JSON.stringify([
                    {
                        addonSlug: 'commerce-addon',
                        appliedAt: '2025-01-01T00:00:00.000Z',
                        limitKey: null,
                        limitIncrease: null,
                        entitlement: null
                    }
                ])
            }
        };

        const billing = buildBillingClient([accommodationSub, commerceSub]);

        // Act
        const result = await queryUserAddons({
            billing: billing as never,
            userId: 'user-host-1'
        });

        // Assert
        expect(result.success).toBe(true);
        if (!result.success) throw new Error('unreachable');
        // Should see the accommodation addon.
        expect(result.data.some((a) => a.addonSlug === 'extra-photos')).toBe(true);
        // Must NOT see the commerce-only addon.
        expect(result.data.some((a) => a.addonSlug === 'commerce-addon')).toBe(false);
    });

    it('customer whose ONLY sub is a commerce sub resolves to NO accommodation addons ' +
        '(the commerce sub is invisible to the accommodation engine)', async () => {
        // Arrange — only a commerce sub, with addon metadata that must NOT bleed through.
        const commerceSub = withAddonMetadata(
            { id: 'sub-com', status: 'active', productDomain: 'commerce' },
            'commerce-promo-addon'
        );
        const billing = buildBillingClient([commerceSub]);

        // Act
        const result = await queryUserAddons({
            billing: billing as never,
            userId: 'user-commerce-only'
        });

        // Assert
        expect(result.success).toBe(true);
        if (!result.success) throw new Error('unreachable');
        // No accommodation addons: the commerce sub was invisible.
        expect(result.data).toHaveLength(0);
    });

    it('legacy rows (null productDomain) are treated as accommodation — ' +
        'no regression for existing data', async () => {
        // Arrange — a legacy sub without productDomain (column not yet applied or NULL).
        const legacySub = withAddonMetadata(
            { id: 'sub-legacy', status: 'active', productDomain: null },
            'legacy-addon'
        );
        const billing = buildBillingClient([legacySub]);

        // Act
        const result = await queryUserAddons({
            billing: billing as never,
            userId: 'user-legacy'
        });

        // Assert — the legacy sub was treated as accommodation.
        expect(result.success).toBe(true);
        if (!result.success) throw new Error('unreachable');
        expect(result.data.some((a) => a.addonSlug === 'legacy-addon')).toBe(true);
    });

    it('undefined productDomain (column not in SELECT) is treated as accommodation — ' +
        'no regression when qzpay-core does not include the field', async () => {
        // Arrange — productDomain field completely absent from the object.
        const noColumnSub = withAddonMetadata(
            { id: 'sub-nofield', status: 'active' } as StubSubscription,
            'existing-addon'
        );
        const billing = buildBillingClient([noColumnSub]);

        // Act
        const result = await queryUserAddons({
            billing: billing as never,
            userId: 'user-no-field'
        });

        // Assert — sub was treated as accommodation (field absent = include).
        expect(result.success).toBe(true);
        if (!result.success) throw new Error('unreachable');
        expect(result.data.some((a) => a.addonSlug === 'existing-addon')).toBe(true);
    });

    it('trialing accommodation sub is included; trialing commerce sub is excluded', async () => {
        // Arrange
        const trialingAccSub = withAddonMetadata(
            { id: 'sub-trial-acc', status: 'trialing', productDomain: 'accommodation' },
            'trial-addon'
        );
        const trialingComSub = withAddonMetadata(
            { id: 'sub-trial-com', status: 'trialing', productDomain: 'commerce' },
            'commerce-trial-addon'
        );
        const billing = buildBillingClient([trialingAccSub, trialingComSub]);

        // Act
        const result = await queryUserAddons({
            billing: billing as never,
            userId: 'user-trial'
        });

        // Assert
        expect(result.success).toBe(true);
        if (!result.success) throw new Error('unreachable');
        expect(result.data.some((a) => a.addonSlug === 'trial-addon')).toBe(true);
        expect(result.data.some((a) => a.addonSlug === 'commerce-trial-addon')).toBe(false);
    });
});
