import { eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { creationSweepModel as model } from '../../src/models/creation-sweep/creation-sweep.model.ts';
import { subscriptionModel } from '../../src/models/subscription/subscription.model.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { billingOptions } from '../../src/schemas/vertical/billing-option.dbschema.ts';
import { idempotencyKeys } from '../../src/schemas/vertical/idempotency-key.dbschema.ts';
import { plans, planVersions } from '../../src/schemas/vertical/plan-catalog.dbschema.ts';
import { providerLinks } from '../../src/schemas/vertical/provider-link.dbschema.ts';
import { subscriptions } from '../../src/schemas/vertical/subscription.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, getTestDb, testData, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);

async function seedAnchors(tx: DrizzleClient) {
    const [plan] = await tx
        .insert(plans)
        .values({
            vertical: 'accommodation',
            slug: `creation-${crypto.randomUUID()}`,
            name: 'Plan de prueba'
        })
        .returning();
    if (!plan) throw new Error('Expected plan');
    const [version] = await tx
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: 'accommodation',
            rank: 12000,
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning();
    if (!version) throw new Error('Expected plan version');
    const [option] = await tx
        .insert(billingOptions)
        .values({
            planVersionId: version.id,
            cycle: 'monthly',
            amount: 1200,
            currency: 'ARS'
        })
        .returning();
    if (!option) throw new Error('Expected billing option');
    return { versionId: version.id, optionId: option.id };
}

async function addRow(args: {
    tx: DrizzleClient;
    anchors: { versionId: string; optionId: string };
    status?: string;
    rowClass?: 'PRINCIPAL' | 'COMPLEMENTO' | 'LAPIDA';
    paymentMethod?: 'CARD' | 'MANUAL';
    windowEndsAt?: Date | null;
    linked?: boolean;
}) {
    const rowClass = args.rowClass ?? 'PRINCIPAL';
    const [user] = await args.tx.insert(users).values(testData.user()).returning();
    if (!user) throw new Error('Expected unique user for principal fixture');
    const [subscription] = await args.tx
        .insert(subscriptions)
        .values({
            userId: user.id,
            vertical: 'accommodation',
            ...(rowClass === 'PRINCIPAL'
                ? { planVersionId: args.anchors.versionId, billingOptionId: args.anchors.optionId }
                : {}),
            paymentMethod: args.paymentMethod ?? 'CARD',
            status: args.status ?? 'PENDING_AUTHORIZATION',
            class: rowClass,
            authorizationWindowDeadlineVersion:
                args.windowEndsAt === undefined || args.windowEndsAt !== null ? 1 : null,
            authorizationWindowEndsAt:
                args.windowEndsAt === undefined
                    ? new Date('2026-11-01T00:00:00.000Z')
                    : args.windowEndsAt
        })
        .returning();
    if (!subscription) throw new Error('Expected subscription');
    if (args.linked) {
        await args.tx.insert(providerLinks).values({
            subscriptionId: subscription.id,
            provider: 'MERCADO_PAGO',
            providerId: `creation-${crypto.randomUUID()}`
        });
    }
    return { subscription, user };
}

describe('creation sweep persistence (supports TEST:B11:23)', () => {
    it('lists only eligible principal card rows, with links, newest key, email and plan name', async () => {
        await withTestTransaction(async (tx) => {
            const anchors = await seedAnchors(tx);
            const now = new Date('2026-10-11T10:00:00.000Z');
            const linked = await addRow({ tx, anchors, linked: true });
            const unlinked = await addRow({ tx, anchors, windowEndsAt: null });
            const newestTime = new Date('2026-10-10T00:00:00.000Z');
            for (const [key, createdAt] of [
                ['creation-old', new Date(newestTime.getTime() - 1_000)],
                ['creation-new', newestTime]
            ] as const) {
                await tx.insert(idempotencyKeys).values({
                    key,
                    operation: 'PREAPPROVAL_CREATE',
                    subjectId: linked.subscription.id,
                    createdAt
                });
            }
            await tx.insert(idempotencyKeys).values({
                key: 'creation-unlinked',
                operation: 'PREAPPROVAL_CREATE',
                subjectId: unlinked.subscription.id,
                createdAt: newestTime
            });

            const active = await addRow({ tx, anchors, status: 'ACTIVE' });
            const abandoned = await addRow({ tx, anchors, status: 'ABANDONED' });
            const manual = await addRow({ tx, anchors, paymentMethod: 'MANUAL' });
            const expired = await addRow({
                tx,
                anchors,
                windowEndsAt: new Date(now.getTime() - 1)
            });
            const complement = await addRow({ tx, anchors, rowClass: 'COMPLEMENTO' });

            const page = await model.listPendingCreationPage({ now, limit: 50, tx });
            expect(page.map(({ subscription }) => subscription.id).sort()).toEqual(
                [linked.subscription.id, unlinked.subscription.id].sort()
            );
            const linkedRow = page.find(
                ({ subscription }) => subscription.id === linked.subscription.id
            )!;
            expect(linkedRow.providerLink?.subscriptionId).toBe(linked.subscription.id);
            expect(linkedRow.newestCreateKey?.key).toBe('creation-new');
            expect(linkedRow.userEmail).toBe(linked.user.email);
            expect(linkedRow.planName).toBe('Plan de prueba');
            expect(
                page.find(({ subscription }) => subscription.id === unlinked.subscription.id)
                    ?.newestCreateKey?.key
            ).toBe('creation-unlinked');
            expect(
                [active, abandoned, manual, expired, complement].every(
                    ({ subscription }) =>
                        !page.some((row) => row.subscription.id === subscription.id)
                )
            ).toBe(true);

            const noKey = await addRow({ tx, anchors });
            const withNoKey = await model.listPendingCreationPage({ now, limit: 50, tx });
            expect(
                withNoKey.find(({ subscription }) => subscription.id === noKey.subscription.id)
                    ?.newestCreateKey
            ).toBeNull();
            const first = await model.listPendingCreationPage({ now, limit: 2, tx });
            const second = await model.listPendingCreationPage({
                now,
                afterSubscriptionId: first.at(-1)!.subscription.id,
                limit: 2,
                tx
            });
            expect(first).toHaveLength(2);
            expect(
                second.every(({ subscription }) => subscription.id > first.at(-1)!.subscription.id)
            ).toBe(true);
        });
    });

    it('mints only under a row lock for an unlinked pending row and leaves earlier keys intact', async () => {
        await withTestTransaction(async (tx) => {
            const anchors = await seedAnchors(tx);
            const pending = await addRow({ tx, anchors });
            await tx.insert(idempotencyKeys).values({
                key: 'creation-previous',
                operation: 'PREAPPROVAL_CREATE',
                subjectId: pending.subscription.id,
                createdAt: new Date('2026-10-01T00:00:00.000Z')
            });
            const createdAt = new Date('2026-10-11T10:00:00.000Z');
            const minted = await model.mintCreateKeyIfUnlinked({
                subscriptionId: pending.subscription.id,
                createdAt,
                tx
            });
            expect(minted?.key).toMatch(/^[0-9a-f-]{36}$/i);
            const keys = await tx
                .select()
                .from(idempotencyKeys)
                .where(eq(idempotencyKeys.subjectId, pending.subscription.id));
            expect(keys.map(({ key }) => key)).toContain('creation-previous');
            expect(keys.find(({ key }) => key === minted?.key)).toMatchObject({
                operation: 'PREAPPROVAL_CREATE',
                result: null,
                completedAt: null,
                createdAt
            });

            const linked = await addRow({ tx, anchors, linked: true });
            const abandoned = await addRow({ tx, anchors, status: 'ABANDONED' });
            expect(
                await model.mintCreateKeyIfUnlinked({
                    subscriptionId: linked.subscription.id,
                    createdAt,
                    tx
                })
            ).toBeNull();
            expect(
                await model.mintCreateKeyIfUnlinked({
                    subscriptionId: abandoned.subscription.id,
                    createdAt,
                    tx
                })
            ).toBeNull();
            expect(
                await model.mintCreateKeyIfUnlinked({
                    subscriptionId: crypto.randomUUID(),
                    createdAt,
                    tx
                })
            ).toBeNull();
            expect(
                await tx
                    .select()
                    .from(idempotencyKeys)
                    .where(eq(idempotencyKeys.subjectId, linked.subscription.id))
            ).toEqual([]);
            expect(
                await tx
                    .select()
                    .from(idempotencyKeys)
                    .where(eq(idempotencyKeys.subjectId, abandoned.subscription.id))
            ).toEqual([]);
        });
    });

    it('waits for a competing transaction holding the subscription row lock', async () => {
        const db = getTestDb();
        const [user] = await db.insert(users).values(testData.user()).returning();
        if (!user) throw new Error('Expected committed lock user');
        const [target] = await db
            .insert(subscriptions)
            .values({
                userId: user.id,
                vertical: 'accommodation',
                paymentMethod: 'CARD',
                class: 'COMPLEMENTO',
                status: 'PENDING_AUTHORIZATION'
            })
            .returning();
        if (!target) throw new Error('Expected committed lock target');
        try {
            await db.transaction(async (tx) => {
                await tx
                    .select()
                    .from(subscriptions)
                    .where(eq(subscriptions.id, target.id))
                    .for('update');
                let failure: unknown;
                try {
                    await db.transaction(async (contender) => {
                        await contender.execute(sql`SET LOCAL lock_timeout = '100ms'`);
                        await model.mintCreateKeyIfUnlinked({
                            subscriptionId: target.id,
                            createdAt: new Date('2026-10-11T10:00:00.000Z'),
                            tx: contender as unknown as DrizzleClient
                        });
                    });
                } catch (error) {
                    failure = error;
                }
                let cause = failure;
                const seen = new Set<unknown>();
                while (cause && typeof cause === 'object' && !seen.has(cause)) {
                    seen.add(cause);
                    const wrapped = cause as { code?: string; cause?: unknown };
                    if (wrapped.code) break;
                    cause = wrapped.cause;
                }
                expect(cause).toMatchObject({ code: '55P03' });
            });
        } finally {
            await db.delete(subscriptions).where(eq(subscriptions.id, target.id));
            await db.delete(users).where(eq(users.id, user.id));
        }
    });

    it('findLiveCommitment chooses the most recently minted key', async () => {
        await withTestTransaction(async (tx) => {
            const anchors = await seedAnchors(tx);
            const [user] = await tx.insert(users).values(testData.user()).returning();
            if (!user) throw new Error('Expected unique user');
            const pending = await subscriptionModel.createPendingAuthorization({
                userId: user.id,
                vertical: 'accommodation',
                planVersionId: anchors.versionId,
                billingOptionId: anchors.optionId,
                authorizationWindowDeadlineVersion: 1,
                authorizationWindowEndsAt: new Date('2026-11-01T00:00:00.000Z'),
                tx
            });
            await tx
                .update(idempotencyKeys)
                .set({ createdAt: new Date('2026-10-10T10:00:00.000Z') })
                .where(eq(idempotencyKeys.key, pending.idempotencyKey));
            const newestKey = 'creation-regression-newest';
            await tx.insert(idempotencyKeys).values({
                key: newestKey,
                operation: 'PREAPPROVAL_CREATE',
                subjectId: pending.subscription.id,
                createdAt: new Date('2026-10-11T10:00:00.000Z')
            });
            const result = await subscriptionModel.findLiveCommitment({
                userId: user.id,
                vertical: 'accommodation',
                tx
            });
            expect(result?.idempotencyKey?.key).toBe(newestKey);
        });
    });

    it('HOS-1725 completeNewestCreateKey completes the key findLiveCommitment reads, ties included', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange: two keys with the SAME created_at, the case only the tie-break decides.
            const anchors = await seedAnchors(tx);
            const [user] = await tx.insert(users).values(testData.user()).returning();
            if (!user) throw new Error('Expected unique user');
            const pending = await subscriptionModel.createPendingAuthorization({
                userId: user.id,
                vertical: 'accommodation',
                planVersionId: anchors.versionId,
                billingOptionId: anchors.optionId,
                authorizationWindowDeadlineVersion: 1,
                authorizationWindowEndsAt: new Date('2026-11-01T00:00:00.000Z'),
                tx
            });
            const tie = new Date('2026-10-11T10:00:00.000Z');
            await tx
                .update(idempotencyKeys)
                .set({ createdAt: tie })
                .where(eq(idempotencyKeys.key, pending.idempotencyKey));
            // Sorts after any hex UUID, so `key DESC` makes it the newest.
            const tied = 'zzzz-tied-key';
            await tx.insert(idempotencyKeys).values({
                key: tied,
                operation: 'PREAPPROVAL_CREATE',
                subjectId: pending.subscription.id,
                createdAt: tie
            });
            const result = {
                authorizationId: 'auth-1',
                applied: true,
                checkoutUrl: 'https://x.test/'
            };

            // Act
            const first = await model.completeNewestCreateKey({
                subscriptionId: pending.subscription.id,
                result,
                completedAt: tie,
                tx
            });
            const second = await model.completeNewestCreateKey({
                subscriptionId: pending.subscription.id,
                result: { ...result, authorizationId: 'auth-2' },
                completedAt: new Date(tie.getTime() + 1),
                tx
            });
            const commitment = await subscriptionModel.findLiveCommitment({
                userId: user.id,
                vertical: 'accommodation',
                tx
            });

            // Assert
            expect(first).toBe(true);
            expect(second).toBe(false);
            expect(commitment?.idempotencyKey?.result).toEqual(result);
            expect(commitment?.idempotencyKey?.completedAt).toEqual(tie);
            const keys = await tx
                .select()
                .from(idempotencyKeys)
                .where(eq(idempotencyKeys.subjectId, pending.subscription.id));
            expect(keys.filter((key) => key.completedAt !== null)).toHaveLength(1);
        });
    });

    it('HOS-1725 completeNewestCreateKey completes nothing for a row without a creation key', async () => {
        await withTestTransaction(async (tx) => {
            const anchors = await seedAnchors(tx);
            const row = await addRow({ tx, anchors });
            expect(
                await model.completeNewestCreateKey({
                    subscriptionId: row.subscription.id,
                    result: { applied: true },
                    completedAt: new Date('2026-10-11T10:00:00.000Z'),
                    tx
                })
            ).toBe(false);
        });
    });
});
