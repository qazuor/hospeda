import { describe, expect, it } from 'vitest';
import {
    type BillingPlanResponse,
    BillingPlanResponseSchema,
    BillingPlanSearchSchema,
    type CreateBillingPlan,
    CreateBillingPlanSchema,
    UpdateBillingPlanSchema
} from '../../../src/api/billing/billing-plan.schema.js';

/** A valid create payload reused across tests. */
const validCreate: CreateBillingPlan = {
    slug: 'owner-basico',
    name: 'Basic',
    description: 'Basic plan for individual property owners.',
    category: 'owner',
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
