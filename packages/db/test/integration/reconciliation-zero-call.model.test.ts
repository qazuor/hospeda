import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { reconciliationZeroCallModel as model } from '../../src/models/reconciliation-inventory/reconciliation-zero-call.model.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { billingOptions } from '../../src/schemas/vertical/billing-option.dbschema.ts';
import { courtesyGrants } from '../../src/schemas/vertical/courtesy-grant.dbschema.ts';
import { plans, planVersions } from '../../src/schemas/vertical/plan-catalog.dbschema.ts';
import {
    LIVE_SUBSCRIPTION_STATUSES,
    subscriptions
} from '../../src/schemas/vertical/subscription.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);

async function anchors(tx: DrizzleClient) {
    const [plan] = await tx
        .insert(plans)
        .values({
            vertical: 'accommodation',
            slug: `zero-${crypto.randomUUID()}`,
            name: 'Zero call fixture'
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
    if (!version) throw new Error('Expected plan version');
    const [option] = await tx
        .insert(billingOptions)
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 1000, currency: 'ARS' })
        .returning();
    if (!option) throw new Error('Expected billing option');
    return { versionId: version.id, optionId: option.id };
}

async function sub(
    tx: DrizzleClient,
    status: string,
    a: { versionId: string; optionId: string },
    relation: { succeedsId?: string; succeededById?: string } = {}
) {
    const [user] = await tx.insert(users).values(testData.user()).returning({ id: users.id });
    if (!user) throw new Error('Expected unique fixture user');
    const [row] = await tx
        .insert(subscriptions)
        .values({
            userId: user.id,
            vertical: 'accommodation',
            paymentMethod: 'CARD',
            planVersionId: a.versionId,
            billingOptionId: a.optionId,
            class: 'PRINCIPAL',
            status,
            ...relation
        })
        .returning();
    if (!row) throw new Error('Expected subscription');
    return row;
}

async function grant(
    tx: DrizzleClient,
    subscriptionId: string,
    balanceMonths: number | null,
    closed = false
) {
    const [user] = await tx.insert(users).values(testData.user()).returning({ id: users.id });
    if (!user) throw new Error('Expected courtesy user');
    const [row] = await tx
        .insert(courtesyGrants)
        .values({
            beneficiaryUserId: user.id,
            months: 1,
            startsAt: new Date('2026-01-01T00:00:00Z'),
            endsAt: new Date('2026-02-01T00:00:00Z'),
            grantedBy: user.id,
            reason: 'fixture',
            subscriptionId,
            balanceMonths,
            ...(closed
                ? {
                      balanceClosedAt: new Date('2026-01-02T00:00:00Z'),
                      closeReason: 'GRANT_PERMANENTE_OTORGADO'
                  }
                : {})
        })
        .returning();
    if (!row) throw new Error('Expected courtesy grant');
    return row;
}

describe('reconciliation zero-call query model', () => {
    it('lists only live successors over dead predecessors in keyset pages', async () => {
        await withTestTransaction(async (tx) => {
            const a = await anchors(tx);
            const dead: string[] = [];
            for (const status of ['CANCELLED', 'ABANDONED', 'CHARGE_DECLINED']) {
                const predecessor = await sub(tx, status, a);
                const successor = await sub(tx, 'ACTIVE', a, { succeedsId: predecessor.id });
                dead.push(successor.id);
            }
            for (const status of LIVE_SUBSCRIPTION_STATUSES) {
                const predecessor = await sub(tx, status, a);
                await sub(tx, 'ACTIVE', a, { succeedsId: predecessor.id });
            }
            const deadPredecessor = await sub(tx, 'CANCELLED', a);
            const nonLiveSuccessor = await sub(tx, 'ABANDONED', a, {
                succeedsId: deadPredecessor.id
            });
            const noPointer = await sub(tx, 'ACTIVE', a);
            const pages: string[] = [];
            let cursor: string | undefined;
            for (;;) {
                const page = await model.listOpenSuccessionsOnDeadPredecessorsPage({
                    afterSubscriptionId: cursor,
                    limit: 2,
                    tx
                });
                if (!page.length) break;
                pages.push(...page.map((row) => row.successor.id));
                cursor = page.at(-1)?.successor.id;
            }
            expect(pages).toEqual([...dead].sort());
            expect(new Set(pages).size).toBe(dead.length);
            const pairs = await model.listOpenSuccessionsOnDeadPredecessorsPage({
                limit: 1000,
                tx
            });
            expect(pairs.map(({ successor }) => successor.id)).toEqual([...dead].sort());
            for (const { successor, predecessor } of pairs) {
                expect(successor.succeedsId).toBe(predecessor.id);
                expect(['CANCELLED', 'ABANDONED', 'CHARGE_DECLINED']).toContain(predecessor.status);
            }
            expect(pages).not.toContain(nonLiveSuccessor.id);
            expect(pages).not.toContain(noPointer.id);
        });
    });

    it('lists only open deferred balances with ACTIVE successors and keyset pages', async () => {
        await withTestTransaction(async (tx) => {
            const a = await anchors(tx);
            const ids: string[] = [];
            const validPred = await sub(tx, 'CANCELLED', a);
            const validSucc = await sub(tx, 'ACTIVE', a, { succeedsId: validPred.id });
            await tx
                .update(subscriptions)
                .set({ succeededById: validSucc.id })
                .where(eq(subscriptions.id, validPred.id));
            ids.push((await grant(tx, validPred.id, 2)).id);
            const closedPred = await sub(tx, 'CANCELLED', a);
            const closedSucc = await sub(tx, 'ACTIVE', a, { succeedsId: closedPred.id });
            await tx
                .update(subscriptions)
                .set({ succeededById: closedSucc.id })
                .where(eq(subscriptions.id, closedPred.id));
            await grant(tx, closedPred.id, 1, true);
            await grant(tx, validPred.id, null);
            for (const status of ['GRACE_PERIOD', 'PENDING_AUTHORIZATION', 'CANCELLED']) {
                const pred = await sub(tx, 'CANCELLED', a);
                const succ = await sub(tx, status, a, { succeedsId: pred.id });
                await tx
                    .update(subscriptions)
                    .set({ succeededById: succ.id })
                    .where(eq(subscriptions.id, pred.id));
                await grant(tx, pred.id, 1);
            }
            const noSuccessor = await sub(tx, 'CANCELLED', a);
            await grant(tx, noSuccessor.id, 1);
            const found: string[] = [];
            let cursor: string | undefined;
            for (;;) {
                const page = await model.listDeferredCourtesiesWithActiveSuccessorPage({
                    afterCourtesyGrantId: cursor,
                    limit: 1,
                    tx
                });
                if (!page.length) break;
                found.push(...page.map(({ courtesyGrant }) => courtesyGrant.id));
                cursor = page.at(-1)?.courtesyGrant.id;
            }
            expect(found).toEqual(ids);
            const [row] = await model.listDeferredCourtesiesWithActiveSuccessorPage({
                limit: 100,
                tx
            });
            expect(row).toMatchObject({
                courtesyGrant: { id: ids[0], balanceMonths: 2, balanceClosedAt: null },
                predecessor: { succeededById: validSucc.id },
                successor: { id: validSucc.id, status: 'ACTIVE' }
            });
        });
    });

    it('filters candidates without live successors, ignoring missing ids and empty input', async () => {
        await withTestTransaction(async (tx) => {
            const a = await anchors(tx);
            const expected: string[] = [(await sub(tx, 'ACTIVE', a)).id];
            const seededGrant = await grant(tx, expected[0]!, 3);
            for (const status of ['ABANDONED', 'CANCELLED']) {
                const pred = await sub(tx, 'CANCELLED', a);
                await sub(tx, status, a, { succeedsId: pred.id });
                expected.push(pred.id);
            }
            const withClosedSuccessor = await sub(tx, 'CANCELLED', a);
            const closedSucc = await sub(tx, 'CANCELLED', a, {
                succeedsId: withClosedSuccessor.id
            });
            await tx
                .update(subscriptions)
                .set({ status: 'CANCELLED', succeededById: closedSucc.id })
                .where(eq(subscriptions.id, withClosedSuccessor.id));
            expected.push(withClosedSuccessor.id);
            const livePreds: string[] = [];
            for (const status of LIVE_SUBSCRIPTION_STATUSES) {
                const pred = await sub(tx, 'CANCELLED', a);
                await sub(tx, status, a, { succeedsId: pred.id });
                livePreds.push(pred.id);
            }
            const ids = [...expected, ...livePreds, crypto.randomUUID()];
            expect(
                [
                    ...(await model.findSubscriptionIdsWithoutLiveSuccessor({
                        subscriptionIds: ids,
                        tx
                    }))
                ].sort()
            ).toEqual([...expected].sort());
            expect(
                await model.findSubscriptionIdsWithoutLiveSuccessor({ subscriptionIds: [], tx })
            ).toEqual([]);
            const seededIds = [...expected, ...livePreds, closedSucc.id];
            const beforeSubs = await tx
                .select()
                .from(subscriptions)
                .where(inArray(subscriptions.id, seededIds));
            const beforeGrants = await tx
                .select()
                .from(courtesyGrants)
                .where(eq(courtesyGrants.id, seededGrant.id));
            await model.listOpenSuccessionsOnDeadPredecessorsPage({ limit: 100, tx });
            await model.listDeferredCourtesiesWithActiveSuccessorPage({ limit: 100, tx });
            await model.findSubscriptionIdsWithoutLiveSuccessor({ subscriptionIds: ids, tx });
            expect(
                await tx.select().from(subscriptions).where(inArray(subscriptions.id, seededIds))
            ).toEqual(beforeSubs);
            expect(
                await tx.select().from(courtesyGrants).where(eq(courtesyGrants.id, seededGrant.id))
            ).toEqual(beforeGrants);
        });
    });
});
