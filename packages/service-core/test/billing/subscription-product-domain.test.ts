/**
 * HOS-75 T-002/T-003 — subscription-product-domain.ts unit tests.
 *
 * T-002: loadSubscriptionDiscountState() — the new shared typed helper that
 * replaces 4 near-identical raw-SQL SELECTs (payment-logic.ts, dunning.job.ts,
 * apply-scheduled-plan-changes.ts, promo-code.renewal.ts).
 *
 * T-003: isAccommodationSubscription() no longer reads the raw snake_case
 * `product_domain` fallback — only the typed `productDomain` property.
 *
 * HOS-217: isOwnerCategorySubscription() — tells an owner/complex plan
 * subscription apart from a tourist-tier one, so a HOST actor's "accommodation
 * subscription" isn't mistaken for a real host plan just because it's in the
 * accommodation domain.
 *
 * No DB, no network — all mocked.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/db', () => ({
    and: vi.fn((...conditions: unknown[]) => ({ and: conditions })),
    billingPlans: {
        id: 'id',
        deletedAt: 'deletedAt',
        metadata: 'metadata'
    },
    billingSubscriptions: {
        id: 'id',
        status: 'status',
        planId: 'planId',
        mpSubscriptionId: 'mpSubscriptionId',
        promoCodeId: 'promoCodeId',
        promoEffectRemainingCycles: 'promoEffectRemainingCycles'
    },
    eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
    getDb: vi.fn(),
    isNull: vi.fn((col: unknown) => ({ isNull: col })),
    sql: vi.fn()
}));

import type { DrizzleClient } from '@repo/db';
import * as dbModule from '@repo/db';
import {
    isAccommodationSubscription,
    isCommerceSubscription,
    isOwnerCategorySubscription,
    loadSubscriptionDiscountState,
    subscriptionMatchesDomain
} from '../../src/services/billing/subscription/subscription-product-domain.js';

const mockGetDb = dbModule.getDb as ReturnType<typeof vi.fn>;

describe('loadSubscriptionDiscountState', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the typed discount-state row when the subscription exists', async () => {
        // Arrange
        const row = {
            id: 'sub-1',
            status: 'active',
            planId: 'plan-1',
            mpSubscriptionId: 'mp-1',
            promoCodeId: 'promo-1',
            promoEffectRemainingCycles: 3
        };
        mockGetDb.mockReturnValue({
            select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([row])
                    })
                })
            })
        });

        // Act
        const result = await loadSubscriptionDiscountState({ subscriptionId: 'sub-1' });

        // Assert
        expect(result).toEqual(row);
    });

    it('returns null when no subscription row is found', async () => {
        // Arrange
        mockGetDb.mockReturnValue({
            select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([])
                    })
                })
            })
        });

        // Act
        const result = await loadSubscriptionDiscountState({ subscriptionId: 'missing-sub' });

        // Assert
        expect(result).toBeNull();
    });

    it('queries a single row (limit 1) filtered by the given subscription id', async () => {
        // Arrange
        const limitMock = vi.fn().mockResolvedValue([]);
        const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
        const fromMock = vi.fn().mockReturnValue({ where: whereMock });
        const selectMock = vi.fn().mockReturnValue({ from: fromMock });
        mockGetDb.mockReturnValue({ select: selectMock });

        // Act
        await loadSubscriptionDiscountState({ subscriptionId: 'sub-42' });

        // Assert
        expect(limitMock).toHaveBeenCalledWith(1);
        expect(whereMock).toHaveBeenCalledTimes(1);
        expect(selectMock).toHaveBeenCalledTimes(1);
    });

    it('null promoCodeId / promoEffectRemainingCycles pass through unchanged (no discount active)', async () => {
        // Arrange
        const row = {
            id: 'sub-2',
            status: 'active',
            planId: 'plan-2',
            mpSubscriptionId: null,
            promoCodeId: null,
            promoEffectRemainingCycles: null
        };
        mockGetDb.mockReturnValue({
            select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([row])
                    })
                })
            })
        });

        // Act
        const result = await loadSubscriptionDiscountState({ subscriptionId: 'sub-2' });

        // Assert
        expect(result).toEqual(row);
    });
});

describe('isAccommodationSubscription — dual-read removal (HOS-75 T-003)', () => {
    it(
        'does NOT fall back to the raw snake_case product_domain field ' +
            '(only the typed camelCase productDomain is read)',
        () => {
            // Arrange — a hypothetical row that carries ONLY the raw snake_case
            // field (as if it came from an untyped `SELECT *`), no camelCase
            // productDomain at all. Before HOS-75 T-003, the `?? record.product_domain`
            // fallback would find 'commerce' here and exclude it (return false).
            const snakeCaseOnlyCommerceRow = {
                id: 'sub-1',
                status: 'active',
                product_domain: 'commerce'
            };

            // Act
            const result = isAccommodationSubscription(snakeCaseOnlyCommerceRow);

            // Assert — post-T-003, the function only reads `productDomain`, which
            // is absent here, so the "undefined → include" default rule applies.
            expect(result).toBe(true);
        }
    );
});

describe('isOwnerCategorySubscription (HOS-217)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    /** Wires `mockGetDb` to resolve the `billing_plans` category lookup with `rows`. */
    function mockCategoryQuery(rows: Array<{ category: string | null }>) {
        mockGetDb.mockReturnValue({
            select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue(rows)
                    })
                })
            })
        });
    }

    it('returns true when the plan category is "owner"', async () => {
        // Arrange
        mockCategoryQuery([{ category: 'owner' }]);

        // Act
        const result = await isOwnerCategorySubscription({ planId: 'plan-owner-basico' });

        // Assert
        expect(result).toBe(true);
    });

    it('returns true when the plan category is "complex"', async () => {
        // Arrange
        mockCategoryQuery([{ category: 'complex' }]);

        // Act
        const result = await isOwnerCategorySubscription({ planId: 'plan-complex-basico' });

        // Assert
        expect(result).toBe(true);
    });

    it('returns true (legacy default) when the plan is found but category is null/absent', async () => {
        // Arrange — a plan predating the `category` metadata key: the row is
        // found, but `metadata->>'category'` resolves to null (jsonb key
        // missing). Must match mapDbToPlan's (plan.crud.ts) legacy default of
        // treating an absent category as 'owner', not fail-closed to false.
        mockCategoryQuery([{ category: null }]);

        // Act
        const result = await isOwnerCategorySubscription({ planId: 'plan-legacy-no-category' });

        // Assert
        expect(result).toBe(true);
    });

    it('returns false when the plan category is "tourist" (the HOS-217 bug case)', async () => {
        // Arrange — e.g. the `tourist-vip` plan a HOST-role actor is still
        // subscribed to after being auto-promoted via host-onboarding.
        mockCategoryQuery([{ category: 'tourist' }]);

        // Act
        const result = await isOwnerCategorySubscription({ planId: 'plan-tourist-vip' });

        // Assert
        expect(result).toBe(false);
    });

    it('returns false (fail-closed) when the plan is not found', async () => {
        // Arrange — no matching row (deleted plan, or a stale/garbage planId).
        mockCategoryQuery([]);

        // Act
        const result = await isOwnerCategorySubscription({ planId: 'missing-plan' });

        // Assert
        expect(result).toBe(false);
    });

    it('uses the caller-provided tx instead of a standalone getDb() connection', async () => {
        // Arrange
        const limitMock = vi.fn().mockResolvedValue([{ category: 'owner' }]);
        const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
        const fromMock = vi.fn().mockReturnValue({ where: whereMock });
        const selectMock = vi.fn().mockReturnValue({ from: fromMock });
        const fakeTx = { select: selectMock } as unknown as DrizzleClient;

        // Act
        await isOwnerCategorySubscription({ planId: 'plan-1', tx: fakeTx });

        // Assert — the standalone getDb() connection was never touched.
        expect(mockGetDb).not.toHaveBeenCalled();
        expect(selectMock).toHaveBeenCalledTimes(1);
    });
});

describe('subscriptionMatchesDomain (HOS-685 → narrowed HOS-695)', () => {
    describe('accommodation / partner — unaffected by the vertical vocabulary', () => {
        it('still recognises an accommodation row as accommodation', () => {
            expect(isAccommodationSubscription({ productDomain: 'accommodation' })).toBe(true);
        });

        it('still keeps a partner row out of both domains', () => {
            expect(isAccommodationSubscription({ productDomain: 'partner' })).toBe(false);
            expect(isCommerceSubscription({ productDomain: 'partner' })).toBe(false);
        });

        it('still treats a legacy row with no domain as accommodation, never as commerce', () => {
            for (const legacy of [{}, { productDomain: null }, { productDomain: undefined }]) {
                expect(isAccommodationSubscription(legacy)).toBe(true);
                expect(isCommerceSubscription(legacy)).toBe(false);
            }
        });

        it('still answers accommodation-open / commerce-closed for a non-object', () => {
            for (const value of [null, undefined, 42, 'commerce']) {
                expect(isAccommodationSubscription(value)).toBe(true);
                expect(isCommerceSubscription(value)).toBe(false);
            }
        });

        it('still rejects a non-string productDomain in every domain', () => {
            const row = { productDomain: 42 };
            expect(isAccommodationSubscription(row)).toBe(false);
            expect(isCommerceSubscription(row)).toBe(false);
            expect(subscriptionMatchesDomain(row, 'gastronomy')).toBe(false);
        });
    });

    describe('HOS-695 — the retired commerce umbrella is no longer recognised', () => {
        it('does NOT recognise a legacy commerce row as a commerce subscription any more', () => {
            // Pre-HOS-695 this was `true` (the transitional umbrella). Release C
            // narrows it: a row still carrying the retired string (it should not,
            // past release B / HOS-692) is now unrecognised, not commerce.
            expect(isCommerceSubscription({ productDomain: 'commerce' })).toBe(false);
        });

        it('still keeps a commerce-stringed row out of the accommodation domain too', () => {
            // Fails closed both ways: an unrecognised value grants nothing.
            expect(isAccommodationSubscription({ productDomain: 'commerce' })).toBe(false);
        });

        it('does not let the retired commerce string satisfy a single vertical', () => {
            const legacyCommerceRow = { productDomain: 'commerce' };
            expect(subscriptionMatchesDomain(legacyCommerceRow, 'gastronomy')).toBe(false);
            expect(subscriptionMatchesDomain(legacyCommerceRow, 'experience')).toBe(false);
        });
    });

    describe('the live verticals', () => {
        it.each([
            'gastronomy',
            'experience'
        ] as const)('counts a %s row as a commerce subscription', (domain) => {
            expect(isCommerceSubscription({ productDomain: domain })).toBe(true);
        });

        it.each([
            'gastronomy',
            'experience'
        ] as const)('keeps a %s row OUT of the accommodation domain', (domain) => {
            // The SPEC-239 isolation invariant. A leak here would hand a
            // vertical subscription to a host's entitlement engine — the one
            // failure mode that grants access rather than withholding it.
            expect(isAccommodationSubscription({ productDomain: domain })).toBe(false);
        });

        it('matches a vertical only against itself', () => {
            expect(subscriptionMatchesDomain({ productDomain: 'gastronomy' }, 'gastronomy')).toBe(
                true
            );
            expect(subscriptionMatchesDomain({ productDomain: 'gastronomy' }, 'experience')).toBe(
                false
            );
        });

        it('fails closed on a domain value nobody defined', () => {
            // The failure mode of an unrecognised value must be a dark listing,
            // never a granted entitlement.
            const unknownRow = { productDomain: 'retail' };
            expect(isAccommodationSubscription(unknownRow)).toBe(false);
            expect(isCommerceSubscription(unknownRow)).toBe(false);
        });
    });

    describe('the two exported predicates are wrappers, not copies', () => {
        it('agrees with the canonical helper on every domain value', () => {
            const rows = [
                {},
                { productDomain: null },
                { productDomain: 'accommodation' },
                { productDomain: 'commerce' },
                { productDomain: 'gastronomy' },
                { productDomain: 'experience' },
                { productDomain: 'partner' },
                { productDomain: 'retail' }
            ];

            for (const row of rows) {
                expect(isAccommodationSubscription(row)).toBe(
                    subscriptionMatchesDomain(row, 'accommodation')
                );
                // isCommerceSubscription ORs the canonical helper across both live
                // verticals (COMMERCE_DOMAINS) — it is no longer a single-value
                // lookup, since 'commerce' is not a domain that exists any more.
                expect(isCommerceSubscription(row)).toBe(
                    subscriptionMatchesDomain(row, 'gastronomy') ||
                        subscriptionMatchesDomain(row, 'experience')
                );
            }
        });
    });
});
