import { describe, expect, it } from 'vitest';
import {
    AdminPlanCatalogQuerySchema,
    AdminPlanCatalogResponseSchema
} from '../../src/catalog/plan-catalog-admin.schema.js';

describe('TEST:1704 schema for admin plan catalog', () => {
    it('accepts a plan without a current version', () => {
        expect(
            AdminPlanCatalogResponseSchema.safeParse({
                vertical: 'venue',
                plans: [
                    {
                        planId: '00000000-0000-4000-8000-000000000001',
                        slug: 'starter',
                        name: 'Starter',
                        description: null,
                        pricingOrder: 1,
                        role: null,
                        currentVersion: null
                    }
                ]
            }).success
        ).toBe(true);
    });

    it('rejects unknown verticals and billing cycles', () => {
        expect(AdminPlanCatalogQuerySchema.safeParse({ vertical: 'foo' }).success).toBe(false);
        expect(
            AdminPlanCatalogResponseSchema.safeParse({
                vertical: 'venue',
                plans: [
                    {
                        planId: '00000000-0000-4000-8000-000000000001',
                        slug: 'starter',
                        name: 'Starter',
                        description: null,
                        pricingOrder: 1,
                        role: null,
                        currentVersion: {
                            versionId: '00000000-0000-4000-8000-000000000002',
                            rank: 1,
                            sellable: true,
                            trialDays: 0,
                            graceDays: 0,
                            allowsPause: false,
                            inheritsTouristVip: false,
                            entitlements: [],
                            limits: [],
                            cycles: ['weekly']
                        }
                    }
                ]
            }).success
        ).toBe(false);
    });
});
