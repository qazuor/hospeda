import { ServiceErrorCode } from '@repo/schemas';
import { ADDON_VERSION_PUBLICATION_REJECTIONS } from '@repo/service-core';
import type { Context } from 'hono';
import { describe, expect, it } from 'vitest';
import {
    ADDON_VERSION_PUBLICATION_REJECTION_ANSWERS,
    answerAddonVersionPublicationRejection
} from '../../../src/routes/billing-addon-product/admin/rejections.js';

const expected = {
    ADMINISTRATIVE_ACTION_FORBIDDEN: [403, ServiceErrorCode.FORBIDDEN],
    ADDON_PRODUCT_NOT_FOUND: [404, ServiceErrorCode.NOT_FOUND],
    ADDON_VERSION_NOT_FOUND: [404, ServiceErrorCode.NOT_FOUND],
    ADDON_VERSION_OF_ANOTHER_ADDON: [409, ServiceErrorCode.ALREADY_EXISTS],
    ADDON_VERSION_INCOMPATIBLE_WITH_CHARGE_KIND: [400, ServiceErrorCode.VALIDATION_ERROR],
    ADDON_PRICE_BELOW_PROVIDER_MINIMUM: [400, ServiceErrorCode.VALIDATION_ERROR],
    ADDON_PRICE_ABOVE_PROVIDER_MAXIMUM: [400, ServiceErrorCode.VALIDATION_ERROR],
    ADDON_PRODUCT_HAS_LIVE_INSTANCES: [409, ServiceErrorCode.ALREADY_EXISTS],
    ADDON_PRODUCT_CHANGED_SINCE_PREVIEW: [409, ServiceErrorCode.ALREADY_EXISTS],
    ADDON_PRODUCT_UNCHANGED: [400, ServiceErrorCode.VALIDATION_ERROR],
    INVALID_ADDON_VERSION_PUBLICATION_INPUT: [400, ServiceErrorCode.VALIDATION_ERROR]
} as const;

describe('TEST:B10:9 AC:B10:8 action 20 HTTP rejection contract', () => {
    it('covers every exported service reason with its documented HTTP answer', () => {
        expect(Object.keys(ADDON_VERSION_PUBLICATION_REJECTION_ANSWERS).sort()).toEqual(
            [...ADDON_VERSION_PUBLICATION_REJECTIONS].sort()
        );
        for (const reason of ADDON_VERSION_PUBLICATION_REJECTIONS) {
            const answer = ADDON_VERSION_PUBLICATION_REJECTION_ANSWERS[reason];
            expect([answer.status, answer.code]).toEqual(expected[reason]);
            expect(answer.status).toBeLessThan(500);
        }
    });

    it('rethrows unrelated errors', () => {
        const error = new Error('unexpected');
        expect(() => answerAddonVersionPublicationRejection({ error, ctx: {} as Context })).toThrow(
            error
        );
    });
});
