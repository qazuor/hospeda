import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { domainEventModel } from '../../src/models/domain-event/domain-event.model.ts';
import { reconciliationInventoryModel } from '../../src/models/reconciliation-inventory/reconciliation-inventory.model.ts';
import { reconciliationTerminalReturnModel as model } from '../../src/models/reconciliation-inventory/reconciliation-terminal-return.model.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { billingOptions } from '../../src/schemas/vertical/billing-option.dbschema.ts';
import { manualPayments } from '../../src/schemas/vertical/manual-payment.dbschema.ts';
import { plans, planVersions } from '../../src/schemas/vertical/plan-catalog.dbschema.ts';
import { providerLinks } from '../../src/schemas/vertical/provider-link.dbschema.ts';
import { reconciliationMarks } from '../../src/schemas/vertical/reconciliation-mark.dbschema.ts';
import { subscriptions } from '../../src/schemas/vertical/subscription.dbschema.ts';
import { successionRetainedPayments } from '../../src/schemas/vertical/succession-retained-payment.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);

async function anchor(tx: DrizzleClient) {
    const [plan] = await tx
        .insert(plans)
        .values({
            vertical: 'accommodation',
            slug: `terminal-${crypto.randomUUID()}`,
            name: 'Terminal return test'
        })
        .returning();
    if (!plan) throw new Error('Expected plan');
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
    if (!version) throw new Error('Expected version');
    const optionIds: Record<string, string> = {};
    for (const cycle of ['monthly', 'annual'] as const) {
        const [option] = await tx
            .insert(billingOptions)
            .values({ planVersionId: version.id, cycle, amount: 1000, currency: 'ARS' })
            .returning();
        if (!option) throw new Error('Expected billing option');
        optionIds[cycle] = option.id;
    }
    return { versionId: version.id, optionIds };
}

async function add(
    tx: DrizzleClient,
    anchors: Awaited<ReturnType<typeof anchor>>,
    args: {
        status?: string;
        linked?: boolean;
        cycle?: 'monthly' | 'annual';
        seenAt?: Date | null;
        rowClass?: 'PRINCIPAL' | 'COMPLEMENTO' | 'LAPIDA';
    }
) {
    const [user] = await tx.insert(users).values(testData.user()).returning({ id: users.id });
    if (!user) throw new Error('Expected user');
    const id = crypto.randomUUID();
    const [subscription] = await tx
        .insert(subscriptions)
        .values({
            id,
            userId: user.id,
            vertical: 'accommodation',
            ...(args.rowClass !== 'COMPLEMENTO' && args.rowClass !== 'LAPIDA'
                ? {
                      planVersionId: anchors.versionId,
                      billingOptionId: args.cycle
                          ? anchors.optionIds[args.cycle]
                          : anchors.optionIds.monthly
                  }
                : {}),
            paymentMethod: 'CARD',
            class: args.rowClass ?? 'PRINCIPAL',
            status: args.status ?? 'CANCELLED'
        })
        .returning();
    if (!subscription) throw new Error('Expected subscription');
    if (args.linked !== false)
        await tx.insert(providerLinks).values({
            subscriptionId: id,
            provider: 'MERCADO_PAGO',
            providerId: `p-${id}`,
            cancelledSeenAt: args.seenAt ?? null
        });
    return subscription;
}

async function mark(tx: DrizzleClient, id: string, reason = 'ESTADO_DIVERGENTE') {
    return tx.insert(reconciliationMarks).values({ subscriptionId: id, reason }).returning();
}

async function event(
    tx: DrizzleClient,
    id: string,
    eventType:
        | 'subscription.provider_cancellation_decided'
        | 'subscription.provider_cancelled_after_rejection'
) {
    return domainEventModel.insert({
        eventType,
        entityType: 'subscription',
        entityId: id,
        actorType: 'job',
        correlationId: crypto.randomUUID(),
        reason: 'S16',
        occurredAt: new Date('2026-10-01T00:00:00Z'),
        tx
    });
}

const now = new Date('2026-10-15T00:00:00Z');
const cutoffs = {
    monthly: new Date(now.getTime() - 31 * 86_400_000),
    quarterly: new Date(now.getTime() - 92 * 86_400_000),
    semiannual: new Date(now.getTime() - 184 * 86_400_000),
    annual: new Date(now.getTime() - 366 * 86_400_000),
    none: new Date(now.getTime() - 366 * 86_400_000)
};

describe('reconciliation terminal return population', () => {
    it('partitions retry rows, marks, cycle cutoffs, rejection and live rows (TEST:1606:1)', async () => {
        await withTestTransaction(async (tx) => {
            const anchors = await anchor(tx);
            const ids = new Map<string, string>();
            const openMark = await add(tx, anchors, {});
            ids.set('mark', openMark.id);
            await mark(tx, openMark.id);
            const closedMark = await add(tx, anchors, {});
            ids.set('lifted', closedMark.id);
            const [placed] = await mark(tx, closedMark.id);
            if (!placed || !closedMark.userId) throw new Error('Expected mark and user');
            await tx
                .update(reconciliationMarks)
                .set({ liftedAt: now, liftedBy: closedMark.userId })
                .where(eq(reconciliationMarks.id, placed.id));
            const retained = await add(tx, anchors, {});
            ids.set('retention', retained.id);
            const [manualPayment] = await tx
                .insert(manualPayments)
                .values({ subscriptionId: retained.id, periodStart: now, status: 'AWAITING' })
                .returning();
            if (!manualPayment) throw new Error('Expected retained manual payment');
            await tx.insert(successionRetainedPayments).values({
                subscriptionId: retained.id,
                manualPaymentId: manualPayment.id,
                unpaidSince: now
            });
            const released = await add(tx, anchors, {});
            ids.set('released', released.id);
            const [releasedPayment] = await tx
                .insert(manualPayments)
                .values({ subscriptionId: released.id, periodStart: now, status: 'AWAITING' })
                .returning();
            if (!releasedPayment) throw new Error('Expected released manual payment');
            await tx.insert(successionRetainedPayments).values({
                subscriptionId: released.id,
                manualPaymentId: releasedPayment.id,
                unpaidSince: now,
                releasedAt: now,
                releaseReason: 'SUCCESSION_CLOSED'
            });
            const insideMonthly = await add(tx, anchors, {
                seenAt: new Date(cutoffs.monthly.getTime() + 1)
            });
            ids.set('monthly', insideMonthly.id);
            const outsideMonthly = await add(tx, anchors, {
                seenAt: new Date(cutoffs.monthly.getTime() - 1)
            });
            ids.set('outsideMonthly', outsideMonthly.id);
            const insideAnnual = await add(tx, anchors, {
                cycle: 'annual',
                seenAt: new Date(cutoffs.annual.getTime() + 1)
            });
            ids.set('annual', insideAnnual.id);
            const outsideAnnual = await add(tx, anchors, {
                cycle: 'annual',
                seenAt: new Date(cutoffs.annual.getTime() - 1)
            });
            ids.set('outsideAnnual', outsideAnnual.id);
            const withoutOption = await add(tx, anchors, {
                rowClass: 'COMPLEMENTO',
                seenAt: new Date(cutoffs.none.getTime() + 1)
            });
            ids.set('none', withoutOption.id);
            const noOptionOutside = await add(tx, anchors, {
                rowClass: 'LAPIDA',
                seenAt: new Date(cutoffs.none.getTime() - 1)
            });
            ids.set('noneOutside', noOptionOutside.id);
            const noLink = await add(tx, anchors, { linked: false });
            ids.set('unlinked', noLink.id);
            const undecided = await add(tx, anchors, {});
            ids.set('undecided', undecided.id);
            const retryNoMark = await add(tx, anchors, {});
            ids.set('retryNoMark', retryNoMark.id);
            await event(tx, retryNoMark.id, 'subscription.provider_cancellation_decided');
            await mark(tx, retryNoMark.id, 'DIVERGENCIA_DE_MONTO');
            const retryMarked = await add(tx, anchors, {});
            ids.set('retryMarked', retryMarked.id);
            await event(tx, retryMarked.id, 'subscription.provider_cancellation_decided');
            await mark(tx, retryMarked.id, 'CANCELACION_SIN_CONFIRMAR');
            const retrySeen = await add(tx, anchors, {
                seenAt: new Date(cutoffs.monthly.getTime() + 1)
            });
            ids.set('retrySeen', retrySeen.id);
            await event(tx, retrySeen.id, 'subscription.provider_cancellation_decided');
            const declined = await add(tx, anchors, {
                status: 'CHARGE_DECLINED',
                seenAt: new Date(cutoffs.monthly.getTime() + 1)
            });
            ids.set('declined', declined.id);
            const rejectedEvent = await add(tx, anchors, {
                status: 'CANCELLED',
                seenAt: new Date(cutoffs.monthly.getTime() + 1)
            });
            ids.set('rejectedEvent', rejectedEvent.id);
            await event(tx, rejectedEvent.id, 'subscription.provider_cancelled_after_rejection');
            const common = await add(tx, anchors, { status: 'CANCELLED', seenAt: null });
            ids.set('common', common.id);
            const live = await add(tx, anchors, {
                status: 'ACTIVE',
                seenAt: new Date(cutoffs.monthly.getTime() + 1)
            });
            ids.set('live', live.id);
            const scheduled = await add(tx, anchors, {
                status: 'CANCEL_SCHEDULED',
                seenAt: new Date(cutoffs.monthly.getTime() + 1)
            });
            ids.set('scheduled', scheduled.id);
            const rows: string[] = [];
            let afterSubscriptionId: string | undefined;
            for (;;) {
                const page = await model.listTerminalReturnPage({
                    afterSubscriptionId,
                    limit: 2,
                    holdCutoffs: cutoffs,
                    tx
                });
                if (!page.length) break;
                rows.push(
                    ...page
                        .filter((r) => idsHas(ids, r.subscription.id))
                        .map((r) => r.subscription.id)
                );
                afterSubscriptionId = page.at(-1)?.subscription.id;
            }
            const has = (key: string) => rows.includes(ids.get(key)!);
            expect(has('mark')).toBe(true);
            expect(has('lifted')).toBe(false);
            expect(has('retention')).toBe(true);
            expect(has('released')).toBe(false);
            expect(has('monthly')).toBe(true);
            expect(has('outsideMonthly')).toBe(false);
            expect(has('annual')).toBe(true);
            expect(has('outsideAnnual')).toBe(false);
            expect(has('none')).toBe(true);
            expect(has('noneOutside')).toBe(false);
            expect(has('unlinked')).toBe(false);
            expect(has('undecided')).toBe(false);
            expect(has('retryNoMark')).toBe(false);
            expect(has('retryMarked')).toBe(true);
            expect(has('retrySeen')).toBe(true);
            expect(has('declined')).toBe(true);
            expect(has('rejectedEvent')).toBe(true);
            expect(has('common')).toBe(false);
            expect(has('live')).toBe(false);
            expect(has('scheduled')).toBe(false);
            const retryAll = await reconciliationInventoryModel.listCancellationRetryPage({
                limit: 100,
                tx
            });
            const retryFiltered = await reconciliationInventoryModel.listCancellationRetryPage({
                limit: 100,
                tx,
                unconfirmedOnly: true
            });
            for (const key of ['retryNoMark', 'retryMarked', 'retrySeen'])
                expect(retryAll.some((r) => r.subscription.id === ids.get(key))).toBe(true);
            expect(retryFiltered.some((r) => r.subscription.id === ids.get('retryNoMark'))).toBe(
                true
            );
            expect(
                retryFiltered.some((r) =>
                    [ids.get('retryMarked'), ids.get('retrySeen')].includes(r.subscription.id)
                )
            ).toBe(false);
            const fetched = await model.listTerminalReturnPage({
                limit: 100,
                holdCutoffs: cutoffs,
                tx
            });
            expect(fetched.find((r) => r.subscription.id === ids.get('mark'))?.hasOpenMark).toBe(
                true
            );
            expect(
                fetched.find((r) => r.subscription.id === ids.get('retention'))?.hasOpenRetention
            ).toBe(true);
            expect(
                fetched.find((r) => r.subscription.id === ids.get('declined'))?.rejectionTerminal
            ).toBe(true);
            expect(
                fetched.find((r) => r.subscription.id === ids.get('rejectedEvent'))
                    ?.rejectionTerminal
            ).toBe(true);
            expect(
                fetched.find((r) => r.subscription.id === ids.get('common'))?.rejectionTerminal
            ).toBe(false);
            expect(new Set(rows).size).toBe(rows.length);
        });
    });
});
function idsHas(ids: Map<string, string>, id: string): boolean {
    return [...ids.values()].includes(id);
}
