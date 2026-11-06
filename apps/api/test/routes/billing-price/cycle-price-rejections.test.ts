import { ServiceErrorCode } from '@repo/schemas';
import { CYCLE_PRICE_REJECTIONS } from '@repo/service-core';
import type { Context } from 'hono';
import { describe, expect, it } from 'vitest';
import {
    answerCyclePriceRejection,
    CYCLE_PRICE_REJECTION_ANSWERS
} from '../../../src/routes/billing-price/admin/rejections.js';

const expected = {
    ADMINISTRATIVE_ACTION_FORBIDDEN: [403, ServiceErrorCode.FORBIDDEN],
    PLAN_VERSION_NOT_FOUND: [404, ServiceErrorCode.NOT_FOUND],
    PLAN_VERSION_NOT_SELLABLE: [422, ServiceErrorCode.VALIDATION_ERROR],
    CYCLE_PRICE_BELOW_PROVIDER_MINIMUM: [422, ServiceErrorCode.VALIDATION_ERROR],
    CYCLE_PRICE_ABOVE_PROVIDER_MAXIMUM: [422, ServiceErrorCode.VALIDATION_ERROR],
    CYCLE_NOT_LONGER_THAN_GRACE: [422, ServiceErrorCode.VALIDATION_ERROR],
    PLAN_VERSION_HAS_CUSTOMERS: [409, ServiceErrorCode.ALREADY_EXISTS],
    CYCLE_PRICE_CHANGED_SINCE_PREVIEW: [409, ServiceErrorCode.ALREADY_EXISTS],
    CYCLE_PRICE_UNCHANGED: [422, ServiceErrorCode.VALIDATION_ERROR],
    INVALID_CYCLE_PRICE_INPUT: [422, ServiceErrorCode.VALIDATION_ERROR]
} as const;

describe('ACC_19 cycle price HTTP rejection contract', () => {
    it('maps every service reason to the documented status and code without a 5xx', () => {
        expect(Object.keys(CYCLE_PRICE_REJECTION_ANSWERS).sort()).toEqual(
            [...CYCLE_PRICE_REJECTIONS].sort()
        );
        for (const reason of CYCLE_PRICE_REJECTIONS) {
            const answer = CYCLE_PRICE_REJECTION_ANSWERS[reason];
            expect([answer.status, answer.code]).toEqual(expected[reason]);
            expect(answer.status).toBeLessThan(500);
            expect(answer.code).not.toBe(ServiceErrorCode.INTERNAL_ERROR);
        }
    });

    it('rethrows errors outside the typed service rejection family', () => {
        const error = new Error('unexpected');
        expect(() => answerCyclePriceRejection({ error, ctx: {} as Context })).toThrow(error);
    });
});
