import { describe, expect, it } from 'vitest';
import {
    CyclePricePreviewRequestSchema,
    SetCyclePriceRequestSchema
} from '../../../src/api/billing/cycle-price-admin.schema.js';

const planVersionId = '11111111-1111-4111-8111-111111111111';

const validPreview = {
    planVersionId,
    cycle: 'monthly',
    amount: 1500
} as const;

describe('AC:B2:4 HOS-1515 cycle price request schemas', () => {
    it('accepts a valid preview request', () => {
        expect(CyclePricePreviewRequestSchema.safeParse(validPreview).success).toBe(true);
    });

    it.each([
        ['decimal', 1500.5],
        ['zero', 0],
        ['negative', -1500]
    ])('rejects a %s amount', (_label, amount) => {
        expect(CyclePricePreviewRequestSchema.safeParse({ ...validPreview, amount }).success).toBe(
            false
        );
    });

    it('rejects a cycle outside the four supported ones', () => {
        expect(
            CyclePricePreviewRequestSchema.safeParse({ ...validPreview, cycle: 'weekly' }).success
        ).toBe(false);
    });

    it('rejects a planVersionId that is not a uuid', () => {
        expect(
            CyclePricePreviewRequestSchema.safeParse({
                ...validPreview,
                planVersionId: 'plan-version-1'
            }).success
        ).toBe(false);
    });

    it('rejects an extra key', () => {
        expect(
            CyclePricePreviewRequestSchema.safeParse({ ...validPreview, currency: 'ARS' }).success
        ).toBe(false);
    });
});

describe('AC:B2:4 HOS-1515 confirmed cycle price request schema', () => {
    const validSet = { ...validPreview, expectedPreviousAmount: 1200, confirmed: true } as const;

    it('accepts a confirmed request', () => {
        expect(SetCyclePriceRequestSchema.safeParse(validSet).success).toBe(true);
    });

    it('requires confirmed to be exactly true', () => {
        expect(
            SetCyclePriceRequestSchema.safeParse({ ...validSet, confirmed: false }).success
        ).toBe(false);
        const { confirmed: _confirmed, ...withoutConfirmation } = validSet;
        expect(SetCyclePriceRequestSchema.safeParse(withoutConfirmation).success).toBe(false);
    });

    it('accepts a null expectedPreviousAmount for a version with no option yet', () => {
        expect(
            SetCyclePriceRequestSchema.safeParse({ ...validSet, expectedPreviousAmount: null })
                .success
        ).toBe(true);
    });
});
