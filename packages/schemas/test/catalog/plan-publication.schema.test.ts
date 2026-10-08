import { describe, expect, it } from 'vitest';
import {
    BILLING_CYCLES,
    CreatePlanRequestSchema,
    PlanPublicationConfirmationSchema,
    PlanVersionEntitlementInputSchema,
    PreviewPlanVersionRequestSchema,
    PublishedPlanVersionSchema,
    PublishPlanVersionRequestSchema
} from '../../src/catalog/plan-publication.schema.js';

const content = {
    rank: 20,
    sellable: true,
    trialDays: 7,
    graceDays: 5,
    allowsPause: true,
    inheritsTouristVip: false
};

describe('HOS-1436 V2.3 — action 18 request contracts (AC:V2:6)', () => {
    it('defaults entitlements and limits to empty lists', () => {
        const parsed = PreviewPlanVersionRequestSchema.parse(content);
        expect(parsed.entitlements).toEqual([]);
        expect(parsed.limits).toEqual([]);
        expect(parsed.cycles).toBeUndefined();
    });

    it('requires the explicit confirmation to publish, and none to preview', () => {
        expect(PublishPlanVersionRequestSchema.safeParse(content).success).toBe(false);
        expect(
            PublishPlanVersionRequestSchema.safeParse({ ...content, confirmed: false }).success
        ).toBe(false);
        expect(
            PublishPlanVersionRequestSchema.safeParse({ ...content, confirmed: true }).success
        ).toBe(true);
    });

    it('accepts only the closed billing cycles, as an optional subset', () => {
        expect([...BILLING_CYCLES]).toEqual(['monthly', 'quarterly', 'semiannual', 'annual']);
        expect(PreviewPlanVersionRequestSchema.safeParse({ ...content, cycles: [] }).success).toBe(
            true
        );
        expect(
            PreviewPlanVersionRequestSchema.safeParse({ ...content, cycles: ['monthly', 'annual'] })
                .success
        ).toBe(true);
        expect(
            PreviewPlanVersionRequestSchema.safeParse({ ...content, cycles: ['weekly'] }).success
        ).toBe(false);
    });

    it('a metered entitlement carries nullable quotas', () => {
        expect(
            PlanVersionEntitlementInputSchema.safeParse({
                key: 'ai_chat',
                planQuota: 100,
                trialQuota: 10
            }).success
        ).toBe(true);
        expect(
            PlanVersionEntitlementInputSchema.safeParse({ key: 'respond_reviews' }).success
        ).toBe(true);
        expect(
            PlanVersionEntitlementInputSchema.safeParse({ key: 'ai_chat', planQuota: -1 }).success
        ).toBe(false);
    });

    it('create-plan accepts an optional role and rejects an unknown one', () => {
        expect(
            CreatePlanRequestSchema.safeParse({
                vertical: 'accommodation',
                slug: 'floor',
                name: 'Floor',
                role: 'floor'
            }).success
        ).toBe(true);
        expect(
            CreatePlanRequestSchema.safeParse({
                vertical: 'accommodation',
                slug: 'basic',
                name: 'Basic'
            }).success
        ).toBe(true);
        expect(
            CreatePlanRequestSchema.safeParse({
                vertical: 'accommodation',
                slug: 'x',
                name: 'X',
                role: 'premium'
            }).success
        ).toBe(false);
    });
});

describe('HOS-1436 V2.3 — confirmation and published result shapes', () => {
    it('the confirmation names the plan, the current version, the anchored customers and the changes', () => {
        const confirmation = {
            planId: '11111111-1111-4111-8111-111111111111',
            vertical: 'accommodation',
            role: null,
            sellable: true,
            currentVersionId: '22222222-2222-4222-8222-222222222222',
            anchoredCustomers: 0,
            changes: [{ key: 'max_photos_per_accommodation', kind: 'limit', from: 20, to: 30 }],
            message: 'Publicar no mueve a los clientes anclados.'
        };
        expect(PlanPublicationConfirmationSchema.safeParse(confirmation).success).toBe(true);
    });

    it('the published version is a plan_version snapshot', () => {
        expect(
            PublishedPlanVersionSchema.safeParse({
                id: '22222222-2222-4222-8222-222222222222',
                planId: '11111111-1111-4111-8111-111111111111',
                vertical: 'accommodation',
                rank: 20,
                sellable: true,
                current: true,
                trialDays: 7,
                graceDays: 5,
                allowsPause: true,
                inheritsTouristVip: false,
                createdAt: new Date().toISOString()
            }).success
        ).toBe(true);
    });
});
