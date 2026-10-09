import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { subscriptionModel } from '../../src/models/subscription/subscription.model.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { billingOptions } from '../../src/schemas/vertical/billing-option.dbschema.ts';
import { idempotencyKeys } from '../../src/schemas/vertical/idempotency-key.dbschema.ts';
import { plans, planVersions } from '../../src/schemas/vertical/plan-catalog.dbschema.ts';
import { providerLinks } from '../../src/schemas/vertical/provider-link.dbschema.ts';
import { subscriptions } from '../../src/schemas/vertical/subscription.dbschema.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);

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

            const pending = await subscriptionModel.createPendingAuthorization({
                userId: user.id,
                vertical: 'accommodation',
                planVersionId: version.id,
                billingOptionId: option.id,
                tx
            });
            expect(pending.subscription.status).toBe('PENDING_AUTHORIZATION');
            expect(pending.subscription.class).toBe('PRINCIPAL');
            expect(pending.subscription.paymentMethod).toBe('CARD');
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
