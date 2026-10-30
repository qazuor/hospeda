import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { domainEventModel } from '../../src/models/domain-event/domain-event.model.ts';
import { reconciliationPauseGiftModel } from '../../src/models/reconciliation-inventory/reconciliation-pause-gift.model.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { billingOptions } from '../../src/schemas/vertical/billing-option.dbschema.ts';
import { plans, planVersions } from '../../src/schemas/vertical/plan-catalog.dbschema.ts';
import { subscriptions } from '../../src/schemas/vertical/subscription.dbschema.ts';
import { subscriptionPauses } from '../../src/schemas/vertical/subscription-pause.dbschema.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);

describe('reconciliation pause gift population', () => {
    it('pages eligible ended customer pauses and excludes a pause with its event', async () => {
        await withTestTransaction(async (tx) => {
            const [user] = await tx
                .insert(users)
                .values(testData.user())
                .returning({ id: users.id });
            const [plan] = await tx
                .insert(plans)
                .values({
                    vertical: 'accommodation',
                    slug: `gift-${crypto.randomUUID()}`,
                    name: 'Gift'
                })
                .returning();
            const [version] = await tx
                .insert(planVersions)
                .values({
                    planId: plan!.id,
                    vertical: 'accommodation',
                    rank: 1,
                    sellable: true,
                    current: true,
                    trialDays: 0,
                    allowsPause: false
                })
                .returning();
            const [option] = await tx
                .insert(billingOptions)
                .values({
                    planVersionId: version!.id,
                    cycle: 'monthly',
                    amount: 1000,
                    currency: 'ARS'
                })
                .returning();
            const [sub] = await tx
                .insert(subscriptions)
                .values({
                    userId: user!.id,
                    vertical: 'accommodation',
                    planVersionId: version!.id,
                    billingOptionId: option!.id,
                    status: 'ACTIVE',
                    class: 'PRINCIPAL',
                    paymentMethod: 'CARD',
                    nextChargeAt: new Date('2026-11-01T12:00:00Z')
                })
                .returning();
            const [pause] = await tx
                .insert(subscriptionPauses)
                .values({
                    subscriptionId: sub!.id,
                    reason: 'CUSTOMER_REQUEST',
                    startsAt: new Date('2026-10-31T12:00:00Z'),
                    actualEndAt: new Date('2026-12-02T12:00:00Z')
                })
                .returning();
            const excluded: Array<{
                reason?: string;
                status?: string;
                paymentMethod?: string;
                nextChargeAt?: Date | null;
                open?: boolean;
                actualEndAt?: Date;
                rowClass?: 'COMPLEMENTO';
            }> = [
                { reason: 'COURTESY' },
                { status: 'SUSPENDED' },
                { paymentMethod: 'MANUAL' },
                { nextChargeAt: null },
                { open: true },
                { actualEndAt: new Date('2026-08-20T12:00:00Z') },
                { rowClass: 'COMPLEMENTO' as const }
            ];
            for (const filter of excluded) {
                const [otherUser] = await tx
                    .insert(users)
                    .values(testData.user())
                    .returning({ id: users.id });
                const [otherSubscription] = await tx
                    .insert(subscriptions)
                    .values({
                        userId: otherUser!.id,
                        vertical: 'accommodation',
                        planVersionId: version!.id,
                        billingOptionId: option!.id,
                        status: filter.status ?? 'ACTIVE',
                        class: filter.rowClass ?? 'PRINCIPAL',
                        paymentMethod: filter.paymentMethod ?? 'CARD',
                        nextChargeAt:
                            filter.nextChargeAt === null ? null : new Date('2026-11-01T12:00:00Z')
                    })
                    .returning({ id: subscriptions.id });
                await tx.insert(subscriptionPauses).values({
                    subscriptionId: otherSubscription!.id,
                    reason: filter.reason ?? 'CUSTOMER_REQUEST',
                    startsAt: new Date(
                        filter.actualEndAt ? '2026-08-01T12:00:00Z' : '2026-10-01T12:00:00Z'
                    ),
                    ...(filter.open
                        ? {}
                        : { actualEndAt: filter.actualEndAt ?? new Date('2026-10-15T12:00:00Z') })
                });
            }
            const rows = await reconciliationPauseGiftModel.listEndedPausePage({
                endedSince: new Date('2026-10-01T00:00:00Z'),
                limit: 10,
                tx
            });
            expect(rows).toEqual([
                {
                    pauseId: pause!.id,
                    subscriptionId: sub!.id,
                    startsAt: new Date('2026-10-31T12:00:00Z'),
                    actualEndAt: new Date('2026-12-02T12:00:00Z'),
                    nextChargeAt: new Date('2026-11-01T12:00:00Z'),
                    cycle: 'monthly'
                }
            ]);
            await domainEventModel.insert({
                eventType: 'reconciliation.pause_gift_detected',
                entityType: 'subscription_pause',
                entityId: pause!.id,
                actorType: 'job',
                correlationId: crypto.randomUUID(),
                tx
            });
            expect(
                await reconciliationPauseGiftModel.listEndedPausePage({
                    endedSince: new Date('2026-10-01T00:00:00Z'),
                    limit: 10,
                    tx
                })
            ).toEqual([]);
            expect(
                await tx
                    .select({ id: subscriptionPauses.id })
                    .from(subscriptionPauses)
                    .where(eq(subscriptionPauses.id, pause!.id))
            ).toHaveLength(1);
        });
    });
});
