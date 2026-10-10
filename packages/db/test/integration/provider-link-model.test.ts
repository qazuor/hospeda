import type { BillingDeadlineValues } from '@repo/schemas';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { subscriptionModel } from '../../src/models/subscription/subscription.model.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { billingDeadlineVersions } from '../../src/schemas/vertical/billing-deadline-version.dbschema.ts';
import { billingOptions } from '../../src/schemas/vertical/billing-option.dbschema.ts';
import { idempotencyKeys } from '../../src/schemas/vertical/idempotency-key.dbschema.ts';
import { plans, planVersions } from '../../src/schemas/vertical/plan-catalog.dbschema.ts';
import { providerLinks } from '../../src/schemas/vertical/provider-link.dbschema.ts';
import { subscriptions } from '../../src/schemas/vertical/subscription.dbschema.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);

const billingDeadlineVersion1Values = {
    '10': { cardHours: 72, manualDays: 7 },
    '11': { noticeDays: 60, contactDays: [30, 7] },
    '12': { noticeDays: 60, contactDays: [30, 7] },
    '13': { daysBefore: [5, 1] },
    '14': { daysBefore: 7 },
    '15': { hoursRemaining: 24 },
    '16': { days: 7 },
    '17': { days: 7 },
    '18': { days: 180 },
    '19': { minutes: 60 }
} satisfies BillingDeadlineValues;

describe('subscription S1 persistence model (TEST:B3:1; TEST:B3:3, DB subset)', () => {
    it('persists the pending row and key together, then the link and completion together', async () => {
        await withTestTransaction(async (tx) => {
            const [user] = await tx.insert(users).values(testData.user()).returning();
            if (!user) throw new Error('Expected a user');
            const [plan] = await tx
                .insert(plans)
                .values({
                    vertical: 'accommodation',
                    slug: `b3-${crypto.randomUUID()}`,
                    name: 'Basic'
                })
                .returning();
            if (!plan) throw new Error('Expected a plan');
            const [version] = await tx
                .insert(planVersions)
                .values({
                    planId: plan.id,
                    vertical: 'accommodation',
                    rank: 1,
                    sellable: true,
                    current: true,
                    trialDays: 0,
                    allowsPause: false
                })
                .returning();
            if (!version) throw new Error('Expected a plan version');
            const [option] = await tx
                .insert(billingOptions)
                .values({
                    planVersionId: version.id,
                    cycle: 'monthly',
                    amount: 1000,
                    currency: 'ARS'
                })
                .returning();
            if (!option) throw new Error('Expected a billing option');

            await tx
                .insert(billingDeadlineVersions)
                .values({ version: 1, values: billingDeadlineVersion1Values })
                .onConflictDoNothing();
            const pending = await subscriptionModel.createPendingAuthorization({
                userId: user.id,
                vertical: 'accommodation',
                planVersionId: version.id,
                billingOptionId: option.id,
                authorizationWindowDeadlineVersion: 1,
                authorizationWindowEndsAt: new Date('2026-10-11T20:00:00.000Z'),
                tx
            });
            expect(pending.subscription.status).toBe('PENDING_AUTHORIZATION');
            expect(pending.subscription.class).toBe('PRINCIPAL');
            expect(pending.subscription.paymentMethod).toBe('CARD');
            // TEST:B3:10 (base: versión y vencimiento guardados al abrir la ventana)
            expect(pending.subscription.authorizationWindowDeadlineVersion).toBe(1);
            expect(pending.subscription.authorizationWindowEndsAt).toEqual(
                new Date('2026-10-11T20:00:00.000Z')
            );
            const [keyBeforeCall] = await tx
                .select()
                .from(idempotencyKeys)
                .where(eq(idempotencyKeys.key, pending.idempotencyKey));
            expect(keyBeforeCall).toMatchObject({
                operation: 'PREAPPROVAL_CREATE',
                subjectId: pending.subscription.id,
                result: null,
                completedAt: null
            });
            expect(await tx.select().from(providerLinks)).toEqual([]);

            const completedAt = new Date();
            const providerLink = await subscriptionModel.recordAuthorizationResult({
                idempotencyKey: pending.idempotencyKey,
                subscriptionId: pending.subscription.id,
                provider: 'MERCADO_PAGO',
                providerId: 'approval-model-1',
                result: {
                    authorizationId: 'approval-model-1',
                    approvalUrl: 'https://example.test'
                },
                completedAt,
                tx
            });
            expect(providerLink.subscriptionId).toBe(pending.subscription.id);
            const [keyAfterCall] = await tx
                .select()
                .from(idempotencyKeys)
                .where(eq(idempotencyKeys.key, pending.idempotencyKey));
            expect(keyAfterCall?.completedAt).toEqual(completedAt);
            expect(keyAfterCall?.result).toEqual({
                authorizationId: 'approval-model-1',
                approvalUrl: 'https://example.test'
            });

            await tx
                .update(subscriptions)
                .set({ status: 'CHARGE_DECLINED' })
                .where(eq(subscriptions.id, pending.subscription.id));
            const declined = await subscriptionModel.findDeclinedWithProviderLinks({
                userId: user.id,
                vertical: 'accommodation',
                tx
            });
            expect(declined).toHaveLength(1);
            expect(declined[0]?.providerLink?.providerId).toBe('approval-model-1');
            expect(declined[0]?.subscription.id).toBe(pending.subscription.id);
        });
    });
});
