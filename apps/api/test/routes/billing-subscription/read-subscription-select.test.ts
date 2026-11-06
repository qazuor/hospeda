/**
 * HOS-1979: the own-subscription read must SELECT the billing option and the declared
 * payer email, because the return screen's one-click retry needs both. The fake DB
 * builds each row from the columns the query asks for, so a select that drops a column
 * returns a row without it and this test fails.
 */
import { describe, expect, it, vi } from 'vitest';

const COLUMN_VALUES = vi.hoisted(
    (): Record<string, unknown> => ({
        id: '323e4567-e89b-42d3-a456-426614174000',
        userId: 'user-1',
        vertical: 'accommodation',
        billingOptionId: '223e4567-e89b-42d3-a456-426614174000',
        declaredPayerEmail: 'mp-account@example.test',
        status: 'CHARGE_DECLINED',
        class: 'PRINCIPAL',
        paymentMethod: 'CARD',
        nextChargeAt: null,
        serviceEndsAt: null,
        createdAt: new Date('2026-11-02T00:00:00.000Z')
    })
);

vi.mock('@repo/db', () => {
    return {
        eq: () => null,
        subscriptions: Object.fromEntries(Object.keys(COLUMN_VALUES).map((key) => [key, key])),
        getDb: () => ({
            select: (fields: Record<string, unknown>) => ({
                from: () => ({
                    where: () => ({
                        limit: async () => [
                            Object.fromEntries(
                                Object.keys(fields).map((key) => [key, COLUMN_VALUES[key]])
                            )
                        ]
                    })
                })
            })
        })
    };
});

import { SubscriptionReadSchema } from '@repo/schemas';
import { readSubscription } from '../../../src/routes/billing-subscription/read-subscription';

describe('readSubscription select (HOS-1979)', () => {
    it('returns the billing option and the declared payer email', async () => {
        const found = await readSubscription('sub-1');

        expect(found?.row.billingOptionId).toBe('223e4567-e89b-42d3-a456-426614174000');
        expect(found?.row.declaredPayerEmail).toBe('mp-account@example.test');
    });

    it('produces a row the public read contract accepts', async () => {
        const found = await readSubscription('sub-1');
        const { userId: _userId, ...publicFields } = found?.row ?? ({} as Record<string, unknown>);

        expect(SubscriptionReadSchema.safeParse(publicFields).success).toBe(true);
    });
});
