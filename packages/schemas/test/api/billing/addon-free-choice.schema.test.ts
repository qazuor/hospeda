import { describe, expect, it } from 'vitest';
import {
    AddonFreeChoiceRequestSchema,
    AddonFreeChoiceResponseSchema
} from '../../../src/api/billing/addon-free-choice.schema';

const id = '00000000-0000-4000-8000-000000000001';

describe('protected addon free choice contract', () => {
    it('accepts one strict owner choice and a successful active response', () => {
        const request = {
            productId: id,
            targetId: null,
            orderRequestId: 'one',
            addonVersionId: id
        };
        expect(AddonFreeChoiceRequestSchema.parse(request)).toEqual(request);
        expect(
            AddonFreeChoiceResponseSchema.parse({
                outcome: 'CREATED',
                instanceId: id,
                status: 'ACTIVE'
            })
        ).toMatchObject({ status: 'ACTIVE' });
    });

    it('rejects payment details, empty or long order ids, and a pending response', () => {
        const request = {
            productId: id,
            targetId: null,
            orderRequestId: 'one',
            addonVersionId: id
        };
        expect(AddonFreeChoiceRequestSchema.safeParse({ ...request, payment: {} }).success).toBe(
            false
        );
        expect(
            AddonFreeChoiceRequestSchema.safeParse({ ...request, orderRequestId: '' }).success
        ).toBe(false);
        expect(
            AddonFreeChoiceRequestSchema.safeParse({ ...request, orderRequestId: 'x'.repeat(65) })
                .success
        ).toBe(false);
        expect(
            AddonFreeChoiceResponseSchema.safeParse({
                outcome: 'CREATED',
                instanceId: id,
                status: 'PENDING_AUTHORIZATION'
            }).success
        ).toBe(false);
    });
});
