import { describe, expect, it } from 'vitest';
import {
    AdminBillingPlanResponseSchema,
    AdminBillingPlanUpdateResponseSchema,
    type BillingPlanResponse,
    BillingPlanResponseSchema,
    BillingPlanSearchSchema,
    type CreateBillingPlan,
    CreateBillingPlanSchema,
    UpdateBillingPlanSchema
} from '../../../src/api/billing/billing-plan.schema.js';
import { ProductDomainEnum } from '../../../src/enums/product-domain.enum.js';

/** A valid create payload reused across tests. */
const validCreate: CreateBillingPlan = {
    slug: 'owner-basico',
    name: 'Basic',
    description: 'Basic plan for individual property owners.',
    category: 'owner',
    productDomain: ProductDomainEnum.ACCOMMODATION,
    monthlyPriceArs: 1_500_000,
    annualPriceArs: 15_000_000,
    monthlyPriceUsdRef: 15,
    hasTrial: true,
    trialDays: 14,
    isDefault: true,
    sortOrder: 1,
    entitlements: ['publish_accommodations', 'edit_accommodation_info'],
    limits: { max_accommodations: 1, max_photos_per_accommodation: 5 },
    isActive: true
};

describe('CreateBillingPlanSchema', () => {
    it('accepts a valid create payload', () => {
        const result = CreateBillingPlanSchema.safeParse(validCreate);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.slug).toBe('owner-basico');
            expect(result.data.limits.max_accommodations).toBe(1);
        }
    });

    it('accepts a free plan with annualPriceArs = null and zero prices', () => {
        const result = CreateBillingPlanSchema.safeParse({
            ...validCreate,
            slug: 'tourist-free',
            monthlyPriceArs: 0,
            annualPriceArs: null,
            monthlyPriceUsdRef: 0,
            hasTrial: false,
            trialDays: 0,
            limits: { max_favorites: -1 }
        });
        expect(result.success).toBe(true);
    });

    describe('productDomain (HOS-1233 AC-15f)', () => {
        it('rejects a payload that omits it, rather than defaulting one', () => {
            // The whole point of the field. `billing_plans.product_domain` is
            // NOT NULL with a default, so a create request without a domain
            // does not fail downstream — it succeeds, and files the plan under
            // whichever vertical the column defaults to. Rejecting here is
            // what stops that from ever being reachable.
            const { productDomain: _omitted, ...withoutDomain } = validCreate;

            const result = CreateBillingPlanSchema.safeParse(withoutDomain);

            expect(result.success).toBe(false);
            expect(result.error?.issues.some((issue) => issue.path[0] === 'productDomain')).toBe(
                true
            );
        });

        it('keeps the domain the caller stated, and does not infer it from category', () => {
            // A tourist plan carries the tourist domain, not the accommodation
            // one its column default would have supplied. Asserting the VALUE
            // rather than its presence is what separates the two: `defined` is
            // exactly what the default already gives.
            const result = CreateBillingPlanSchema.safeParse({
                ...validCreate,
                slug: 'tourist-vip',
                category: 'tourist',
                productDomain: ProductDomainEnum.TOURIST
            });

            expect(result.success).toBe(true);
            expect(result.data?.productDomain).toBe(ProductDomainEnum.TOURIST);
        });

        it('accepts a domain that does not match the category', () => {
            // Category and domain answer different questions, and the schema
            // must not quietly couple them: the three commerce verticals share
            // one category while holding three distinct domains, so a
            // cross-check here would make two of them unrepresentable.
            const result = CreateBillingPlanSchema.safeParse({
                ...validCreate,
                slug: 'gastronomy-basico',
                category: 'owner',
                productDomain: ProductDomainEnum.GASTRONOMY
            });

            expect(result.success).toBe(true);
            expect(result.data?.productDomain).toBe(ProductDomainEnum.GASTRONOMY);
        });

        it('rejects a domain outside the enum', () => {
            const result = CreateBillingPlanSchema.safeParse({
                ...validCreate,
                productDomain: 'commerce'
            });

            expect(result.success).toBe(false);
        });
    });

    it('allows -1 (unlimited) in limits', () => {
        const result = CreateBillingPlanSchema.safeParse({
            ...validCreate,
            limits: { max_accommodations: -1 }
        });
        expect(result.success).toBe(true);
    });

    it('rejects a negative price', () => {
        const result = CreateBillingPlanSchema.safeParse({
            ...validCreate,
            monthlyPriceArs: -1
        });
        expect(result.success).toBe(false);
    });

    it('rejects a limit value below -1', () => {
        const result = CreateBillingPlanSchema.safeParse({
            ...validCreate,
            limits: { max_accommodations: -2 }
        });
        expect(result.success).toBe(false);
    });

    it('rejects an invalid slug format (uppercase / spaces)', () => {
        expect(
            CreateBillingPlanSchema.safeParse({ ...validCreate, slug: 'Owner Basico' }).success
        ).toBe(false);
        expect(CreateBillingPlanSchema.safeParse({ ...validCreate, slug: 'OWNER' }).success).toBe(
            false
        );
    });

    it('rejects an unknown field (strict)', () => {
        const result = CreateBillingPlanSchema.safeParse({
            ...validCreate,
            surprise: true
        });
        expect(result.success).toBe(false);
    });

    it('rejects hasTrial = true with trialDays = 0', () => {
        const result = CreateBillingPlanSchema.safeParse({
            ...validCreate,
            hasTrial: true,
            trialDays: 0
        });
        expect(result.success).toBe(false);
    });

    it('rejects an invalid category', () => {
        const result = CreateBillingPlanSchema.safeParse({
            ...validCreate,
            category: 'enterprise'
        });
        expect(result.success).toBe(false);
    });
});

describe('UpdateBillingPlanSchema', () => {
    it('accepts a partial update', () => {
        const result = UpdateBillingPlanSchema.safeParse({ monthlyPriceArs: 2_000_000 });
        expect(result.success).toBe(true);
    });

    it('accepts an empty update object', () => {
        expect(UpdateBillingPlanSchema.safeParse({}).success).toBe(true);
    });

    it('rejects slug (immutable — strict)', () => {
        const result = UpdateBillingPlanSchema.safeParse({ slug: 'new-slug' });
        expect(result.success).toBe(false);
    });

    it('rejects an unknown field (strict)', () => {
        const result = UpdateBillingPlanSchema.safeParse({ foo: 'bar' });
        expect(result.success).toBe(false);
    });

    it('rejects a negative price on update', () => {
        const result = UpdateBillingPlanSchema.safeParse({ annualPriceArs: -5 });
        expect(result.success).toBe(false);
    });

    it('allows clearing annualPriceArs to null', () => {
        const result = UpdateBillingPlanSchema.safeParse({ annualPriceArs: null });
        expect(result.success).toBe(true);
    });
});

describe('BillingPlanSearchSchema', () => {
    it('applies default pagination', () => {
        const result = BillingPlanSearchSchema.safeParse({});
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.page).toBe(1);
            expect(result.data.pageSize).toBe(20);
        }
    });

    it('coerces active=true and filters by category', () => {
        const result = BillingPlanSearchSchema.safeParse({ active: 'true', category: 'owner' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.active).toBe(true);
            expect(result.data.category).toBe('owner');
        }
    });

    it('rejects pageSize over the max', () => {
        expect(BillingPlanSearchSchema.safeParse({ pageSize: 1000 }).success).toBe(false);
    });
});

describe('BillingPlanResponseSchema', () => {
    const validResponse: BillingPlanResponse = {
        id: '11111111-1111-4111-8111-111111111111',
        slug: 'owner-basico',
        name: 'Basic',
        description: 'Basic plan.',
        category: 'owner',
        monthlyPriceArs: 1_500_000,
        annualPriceArs: 15_000_000,
        monthlyPriceUsdRef: 15,
        hasTrial: true,
        trialDays: 14,
        isDefault: true,
        sortOrder: 1,
        entitlements: ['publish_accommodations'],
        limits: { max_accommodations: 1 },
        isActive: true,
        publicListing: 'listed',
        createdAt: '2026-05-30T00:00:00.000Z',
        updatedAt: '2026-05-30T00:00:00.000Z'
    };

    it('accepts a valid response DTO', () => {
        expect(BillingPlanResponseSchema.safeParse(validResponse).success).toBe(true);
    });

    it('rejects a non-UUID id', () => {
        const result = BillingPlanResponseSchema.safeParse({ ...validResponse, id: 'not-a-uuid' });
        expect(result.success).toBe(false);
    });

    it('rejects a non-datetime createdAt', () => {
        const result = BillingPlanResponseSchema.safeParse({
            ...validResponse,
            createdAt: 'yesterday'
        });
        expect(result.success).toBe(false);
    });
});

describe('AdminBillingPlanResponseSchema (HOS-1314)', () => {
    const validAdminResponse = {
        id: '11111111-1111-4111-8111-111111111111',
        slug: 'gastronomy-pro',
        name: 'Pro',
        description: 'Gastronomy pro plan.',
        category: 'owner' as const,
        monthlyPriceArs: 1_500_000,
        annualPriceArs: 15_000_000,
        monthlyPriceUsdRef: 15,
        hasTrial: false,
        trialDays: 0,
        isDefault: false,
        sortOrder: 1,
        entitlements: ['publish_gastronomy'],
        limits: { max_listings: 3 },
        isActive: true,
        publicListing: 'listed' as const,
        createdAt: '2026-05-30T00:00:00.000Z',
        updatedAt: '2026-05-30T00:00:00.000Z',
        isDeleted: false,
        activeSubscriptionCount: 2,
        productDomain: ProductDomainEnum.GASTRONOMY
    };

    it('accepts a valid admin response DTO carrying productDomain', () => {
        expect(AdminBillingPlanResponseSchema.safeParse(validAdminResponse).success).toBe(true);
    });

    // HOS-1314: the admin grant-comp plan selector groups plans by vertical.
    // Without this field on the response, the DB-backed list route already
    // returned every domain's plans unfiltered but with no way to tell them
    // apart — this is the regression test for that gap.
    it('rejects a response missing productDomain', () => {
        const { productDomain: _omit, ...withoutDomain } = validAdminResponse;
        const result = AdminBillingPlanResponseSchema.safeParse(withoutDomain);
        expect(result.success).toBe(false);
    });

    it('rejects an unrecognised productDomain value', () => {
        const result = AdminBillingPlanResponseSchema.safeParse({
            ...validAdminResponse,
            productDomain: 'commerce'
        });
        expect(result.success).toBe(false);
    });
});

describe('AdminBillingPlanUpdateResponseSchema (HOS-176)', () => {
    const baseResponse = {
        id: '11111111-1111-4111-8111-111111111111',
        slug: 'owner-basico',
        name: 'Basic',
        description: 'Basic plan.',
        category: 'owner' as const,
        monthlyPriceArs: 1_500_000,
        annualPriceArs: 15_000_000,
        monthlyPriceUsdRef: 15,
        hasTrial: true,
        trialDays: 14,
        isDefault: true,
        sortOrder: 1,
        entitlements: ['publish_accommodations'],
        limits: { max_accommodations: 1 },
        isActive: true,
        // HOS-1062 F1: required with no default, so every response carries the
        // public-catalogue mark explicitly.
        publicListing: 'listed' as const,
        createdAt: '2026-05-30T00:00:00.000Z',
        updatedAt: '2026-05-30T00:00:00.000Z'
    };

    it('accepts an update response with an empty priceChangeEffects array', () => {
        expect(
            AdminBillingPlanUpdateResponseSchema.safeParse({
                ...baseResponse,
                priceChangeEffects: []
            }).success
        ).toBe(true);
    });

    it('accepts up to two effects (monthly + annual, mixed direction) and PRESERVES them through the parse', () => {
        const priceChangeEffects = [
            {
                billingInterval: 'month' as const,
                direction: 'increase' as const,
                effectiveAt: '2026-06-14T00:00:00.000Z',
                affectedSubscriberCount: 12
            },
            {
                billingInterval: 'year' as const,
                direction: 'decrease' as const,
                effectiveAt: '2026-05-30T00:00:00.000Z',
                affectedSubscriberCount: 3
            }
        ];
        const result = AdminBillingPlanUpdateResponseSchema.safeParse({
            ...baseResponse,
            priceChangeEffects
        });
        expect(result.success).toBe(true);
        // The extended (non-strict) schema must NOT strip the new field — it round-trips.
        expect(result.success && result.data.priceChangeEffects).toEqual(priceChangeEffects);
    });

    it('rejects an unknown billingInterval', () => {
        const result = AdminBillingPlanUpdateResponseSchema.safeParse({
            ...baseResponse,
            priceChangeEffects: [
                {
                    billingInterval: 'week',
                    direction: 'increase',
                    effectiveAt: '2026-06-14T00:00:00.000Z',
                    affectedSubscriberCount: 1
                }
            ]
        });
        expect(result.success).toBe(false);
    });

    it('rejects a negative affectedSubscriberCount', () => {
        const result = AdminBillingPlanUpdateResponseSchema.safeParse({
            ...baseResponse,
            priceChangeEffects: [
                {
                    billingInterval: 'month',
                    direction: 'increase',
                    effectiveAt: '2026-06-14T00:00:00.000Z',
                    affectedSubscriberCount: -1
                }
            ]
        });
        expect(result.success).toBe(false);
    });

    it('requires priceChangeEffects (missing → invalid)', () => {
        expect(AdminBillingPlanUpdateResponseSchema.safeParse(baseResponse).success).toBe(false);
    });
});
