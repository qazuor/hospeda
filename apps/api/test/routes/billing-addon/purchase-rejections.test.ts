import { PURCHASE_ADDON_REFUSAL_REASONS } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import { PURCHASE_REJECTION_ANSWERS } from '../../../src/routes/billing-addon/purchase-rejections';

describe('addon purchase refusal mapping', () => {
    it('answers 409 ADDON_ORDER_REQUEST_ABANDONED for an abandoned order id', () => {
        expect(PURCHASE_REJECTION_ANSWERS.ORDER_REQUEST_ABANDONED).toEqual({
            status: 409,
            code: 'ADDON_ORDER_REQUEST_ABANDONED'
        });
    });

    it('maps every closed refusal reason', () => {
        expect(Object.keys(PURCHASE_REJECTION_ANSWERS).sort()).toEqual(
            [...PURCHASE_ADDON_REFUSAL_REASONS].sort()
        );
    });
});
