import { eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { domainEventModel } from '../../src/models/domain-event/domain-event.model.ts';
import { reconciliationInventoryModel as model } from '../../src/models/reconciliation-inventory/reconciliation-inventory.model.ts';
import { reconciliationSweepRunModel } from '../../src/models/reconciliation-sweep-run/reconciliation-sweep-run.model.ts';
import { domainEvent } from '../../src/schemas/domain-event/domain_event.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { billingOptions } from '../../src/schemas/vertical/billing-option.dbschema.ts';
import { plans, planVersions } from '../../src/schemas/vertical/plan-catalog.dbschema.ts';
import {
    LIVE_SUBSCRIPTION_STATUSES,
    subscriptions
} from '../../src/schemas/vertical/subscription.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import {
    closeTestPool,
    getTestDb,
    getTestPool,
    testData,
    withCleanSlate,
    withTestTransaction
} from './helpers.ts';

afterAll(closeTestPool);

function postgresCause(
    error: unknown
): { readonly code?: string; readonly constraint?: string } | null {
    const seen = new Set<unknown>();
    let current = error;
    while (current && typeof current === 'object' && !seen.has(current)) {
        seen.add(current);
        const candidate = current as { code?: string; constraint?: string; cause?: unknown };
        if (candidate.code) return candidate;
        current = candidate.cause;
    }
    return null;
}

async function anchor(tx: DrizzleClient, rank = 1) {
    const [plan] = await tx
        .insert(plans)
        .values({
            vertical: 'accommodation',
            slug: `recon-${crypto.randomUUID()}`,
            name: 'Reconciliation fixture'
        })
        .returning();
    if (!plan) throw new Error('Expected plan');
    const [version] = await tx
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: 'accommodation',
            rank,
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning();
    if (!version) throw new Error('Expected version');
    const [option] = await tx
        .insert(billingOptions)
        .values({
            planVersionId: version.id,
            cycle: 'monthly',
            amount: 1000,
            currency: 'ARS'
        })
        .returning();
    if (!option) throw new Error('Expected billing option');
    return { versionId: version.id, optionId: option.id };
}

async function addSubscription(args: {
    readonly tx: DrizzleClient;
    readonly anchors: { readonly versionId: string; readonly optionId: string };
    readonly status: string;
    readonly class?: 'PRINCIPAL' | 'COMPLEMENTO' | 'LAPIDA';
    readonly linked?: boolean;
    readonly providerId?: string;
    readonly manual?: boolean;
}) {
    const id = crypto.randomUUID();
    const [user] = await args.tx.insert(users).values(testData.user()).returning({ id: users.id });
    if (!user) throw new Error('Expected user');
    const rowClass = args.class ?? 'PRINCIPAL';
    const [subscription] = await args.tx
        .insert(subscriptions)
        .values({
            id,
            userId: user.id,
            vertical: 'accommodation',
            ...(rowClass === 'PRINCIPAL'
                ? { planVersionId: args.anchors.versionId, billingOptionId: args.anchors.optionId }
                : {}),
            paymentMethod: args.manual ? 'MANUAL' : 'CARD',
            class: rowClass,
            status: args.status
        })
        .returning();
    if (!subscription) throw new Error('Expected subscription');
    let providerLink = null;
    if (args.linked) {
        providerLink = await model.insertProviderLink({
            subscriptionId: id,
            provider: 'MERCADO_PAGO',
            providerId: args.providerId ?? `provider-${crypto.randomUUID()}`,
            tx: args.tx
        });
    }
    return { subscription, providerLink };
}

describe('reconciliation inventory and re-link persistence', () => {
    it('lists only linked live principal and complement rows in keyset order', async () => {
        await withTestTransaction(async (tx) => {
            const anchors = await anchor(tx);
            const expected: string[] = [];
            for (const status of LIVE_SUBSCRIPTION_STATUSES) {
                for (const rowClass of ['PRINCIPAL', 'COMPLEMENTO'] as const) {
                    const row = await addSubscription({
                        tx,
                        anchors,
                        status,
                        class: rowClass,
                        linked: true
                    });
                    expected.push(row.subscription.id);
                }
            }
            for (const status of ['CANCELLED', 'ABANDONED', 'CHARGE_DECLINED']) {
                await addSubscription({ tx, anchors, status, linked: true });
            }
            const tombstone = await model.insertReceiptTombstone({ tx });
            await model.insertProviderLink({
                subscriptionId: tombstone.id,
                provider: 'MERCADO_PAGO',
                providerId: `tombstone-${crypto.randomUUID()}`,
                tx
            });
            await addSubscription({ tx, anchors, status: 'PENDING_AUTHORIZATION', linked: false });
            await addSubscription({
                tx,
                anchors,
                status: 'ACTIVE',
                class: 'COMPLEMENTO',
                linked: false,
                manual: true
            });

            const pages: string[] = [];
            let afterSubscriptionId: string | undefined;
            while (true) {
                const page = await model.listSweepInventoryPage({
                    afterSubscriptionId,
                    limit: 2,
                    tx
                });
                if (page.length === 0) break;
                pages.push(...page.map(({ subscription }) => subscription.id));
                afterSubscriptionId = page.at(-1)?.subscription.id;
            }
            const sorted = [...expected].sort();
            expect(pages).toEqual(sorted);
            expect(new Set(pages).size).toBe(expected.length);
            expect(
                (await model.listSweepInventoryPage({ limit: 100, tx })).map(
                    ({ subscription }) => subscription.id
                )
            ).toEqual(sorted);
        });
    });

    it('includes rows created after the cycle anchor and orders the null-stamped set by id', async () => {
        await withTestTransaction(async (tx) => {
            const anchors = await anchor(tx);
            const cycle = await reconciliationSweepRunModel.openSlice({
                correlationId: crypto.randomUUID(),
                tx
            });
            const created = [
                await addSubscription({
                    tx,
                    anchors,
                    status: 'ACTIVE',
                    linked: true,
                    class: 'COMPLEMENTO'
                })
            ];
            for (let index = 1; index < 3; index += 1) {
                created.push(
                    await addSubscription({
                        tx,
                        anchors,
                        status: 'ACTIVE',
                        linked: true,
                        class: 'COMPLEMENTO'
                    })
                );
            }
            const rows = await model.listSweepInventoryPage({
                cycleId: cycle.cycleId!,
                limit: 10,
                tx
            });
            const ids = created.map(({ subscription }) => subscription.id).sort();
            expect(rows.map(({ subscription }) => subscription.id)).toEqual(ids);
        });
    });

    it('pages new rows before earlier stamps and orders prior stamps oldest first', async () => {
        try {
            await withCleanSlate(async (db) => {
                const anchors = await anchor(db, 9001);
                const earlier = await addSubscription({
                    tx: db,
                    anchors,
                    status: 'ACTIVE',
                    linked: true,
                    class: 'COMPLEMENTO'
                });
                const later = await addSubscription({
                    tx: db,
                    anchors,
                    status: 'ACTIVE',
                    linked: true,
                    class: 'COMPLEMENTO'
                });
                const firstRun = await reconciliationSweepRunModel.openSlice({
                    correlationId: crypto.randomUUID(),
                    tx: db
                });
                await reconciliationSweepRunModel.stampSweptRow({
                    runId: firstRun.id,
                    subscriptionId: earlier.subscription.id,
                    counters: {},
                    tx: db
                });
                await getTestPool().query('SELECT pg_sleep(0.02)');
                await reconciliationSweepRunModel.stampSweptRow({
                    runId: firstRun.id,
                    subscriptionId: later.subscription.id,
                    counters: {},
                    tx: db
                });
                await reconciliationSweepRunModel.closeSlice({
                    id: firstRun.id,
                    outcome: 'CYCLE_DONE',
                    phase: 'DONE',
                    rowsComplete: true,
                    passesCompleted: [],
                    failedSubscriptionIds: [],
                    tx: db
                });
                const nextCycle = await reconciliationSweepRunModel.openSlice({
                    correlationId: crypto.randomUUID(),
                    tx: db
                });
                const createdMidCycle = await addSubscription({
                    tx: db,
                    anchors,
                    status: 'ACTIVE',
                    linked: true,
                    class: 'COMPLEMENTO'
                });
                const rows = await model.listSweepInventoryPage({
                    cycleId: nextCycle.cycleId!,
                    limit: 10,
                    tx: db
                });
                expect(rows.map(({ subscription }) => subscription.id)).toEqual([
                    createdMidCycle.subscription.id,
                    earlier.subscription.id,
                    later.subscription.id
                ]);
            });
        } finally {
            await withCleanSlate(async () => {});
        }
    });

    it('stamps only the sweep fields, commits with the tombstone trigger, and rejects a closed slice', async () => {
        try {
            await withCleanSlate(async (db) => {
                const anchors = await anchor(db, 9002);
                const { subscription } = await addSubscription({
                    tx: db,
                    anchors,
                    status: 'ACTIVE',
                    linked: true,
                    class: 'COMPLEMENTO'
                });
                const run = await reconciliationSweepRunModel.openSlice({
                    correlationId: crypto.randomUUID(),
                    tx: db
                });
                const [before] = await db
                    .select()
                    .from(subscriptions)
                    .where(eq(subscriptions.id, subscription.id));
                if (!before) throw new Error('Expected subscription fixture');

                const trigger = await getTestPool().query<{ exists: boolean }>(
                    "SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_subscription_tombstone_provider_link' AND NOT tgisinternal) AS exists"
                );
                expect(trigger.rows[0]?.exists).toBe(true);

                expect(
                    await reconciliationSweepRunModel.stampSweptRow({
                        runId: run.id,
                        subscriptionId: subscription.id,
                        counters: { rowsRead: 1 },
                        tx: db
                    })
                ).toEqual({ stamped: true });
                const [after] = await db
                    .select()
                    .from(subscriptions)
                    .where(eq(subscriptions.id, subscription.id));
                if (!after) throw new Error('Expected stamped subscription');
                const {
                    lastSweptAt: beforeStamp,
                    updatedAt: beforeUpdate,
                    ...unchangedFields
                } = before;
                expect(after).toMatchObject(unchangedFields);
                expect(after.lastSweptAt).toBeInstanceOf(Date);
                expect(after.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
                expect(beforeStamp).toBeNull();

                await reconciliationSweepRunModel.closeSlice({
                    id: run.id,
                    outcome: 'TIMED_OUT',
                    phase: 'ROWS',
                    rowsComplete: false,
                    passesCompleted: [],
                    failedSubscriptionIds: [],
                    tx: db
                });
                expect(
                    await reconciliationSweepRunModel.stampSweptRow({
                        runId: run.id,
                        subscriptionId: subscription.id,
                        counters: { rowsRead: 1 },
                        tx: db
                    })
                ).toEqual({ stamped: false });
                const [stillStamped] = await db
                    .select()
                    .from(subscriptions)
                    .where(eq(subscriptions.id, subscription.id));
                expect(stillStamped?.lastSweptAt).toEqual(after.lastSweptAt);
            });
        } finally {
            await withCleanSlate(async () => {});
        }
    });

    it('finds links, locks the subscription row, and never updates subscription fields', async () => {
        await withTestTransaction(async (tx) => {
            const anchors = await anchor(tx);
            const created = await addSubscription({ tx, anchors, status: 'ACTIVE', linked: true });
            const unlinked = await addSubscription({
                tx,
                anchors,
                status: 'ACTIVE',
                linked: false,
                class: 'COMPLEMENTO'
            });
            expect(
                await model.findLinkByProviderId({
                    provider: 'MERCADO_PAGO',
                    providerId: created.providerLink!.providerId,
                    tx
                })
            ).toEqual(created.providerLink);
            expect(
                await model.findLinkByProviderId({
                    provider: 'MERCADO_PAGO',
                    providerId: 'missing',
                    tx
                })
            ).toBeNull();
            expect(
                await model.lockSubscriptionForLink({
                    subscriptionId: unlinked.subscription.id,
                    tx
                })
            ).toMatchObject({ subscription: unlinked.subscription, providerLink: null });
            expect(
                await model.lockSubscriptionForLink({ subscriptionId: crypto.randomUUID(), tx })
            ).toBeNull();

            const [before] = await tx
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, unlinked.subscription.id));
            await model.lockSubscriptionForLink({ subscriptionId: unlinked.subscription.id, tx });
            await model.insertProviderLink({
                subscriptionId: unlinked.subscription.id,
                provider: 'MERCADO_PAGO',
                providerId: 'new-link',
                tx
            });
            const [after] = await tx
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, unlinked.subscription.id));
            expect(after).toEqual(before);

            const [lockUser] = await getTestDb()
                .insert(users)
                .values(testData.user())
                .returning({ id: users.id });
            if (!lockUser) throw new Error('Expected committed lock user');
            const [lockTarget] = await getTestDb()
                .insert(subscriptions)
                .values({
                    userId: lockUser.id,
                    vertical: 'accommodation',
                    paymentMethod: 'CARD',
                    class: 'COMPLEMENTO',
                    status: 'ACTIVE'
                })
                .returning();
            if (!lockTarget) throw new Error('Expected committed lock target');
            try {
                await getTestDb().transaction(async (lockTx) => {
                    await model.lockSubscriptionForLink({
                        subscriptionId: lockTarget.id,
                        tx: lockTx as unknown as DrizzleClient
                    });
                    const other = await getTestPool().connect();
                    try {
                        await other.query("SET lock_timeout = '100ms'");
                        let failure: unknown;
                        try {
                            await other.query('UPDATE subscription SET status = $1 WHERE id = $2', [
                                'PAUSED',
                                lockTarget.id
                            ]);
                        } catch (error) {
                            failure = error;
                        }
                        expect(failure).toMatchObject({ code: '55P03' });
                    } finally {
                        other.release();
                    }
                });
            } finally {
                await getTestDb().delete(subscriptions).where(eq(subscriptions.id, lockTarget.id));
                await getTestDb().delete(users).where(eq(users.id, lockUser.id));
            }
        });
    });

    it('passes both UNIQUE violations through cause and writes only an identity-free receipt tombstone', async () => {
        await withTestTransaction(async (tx) => {
            const anchors = await anchor(tx);
            const first = await addSubscription({
                tx,
                anchors,
                status: 'ACTIVE',
                class: 'COMPLEMENTO'
            });
            const second = await addSubscription({
                tx,
                anchors,
                status: 'ACTIVE',
                class: 'COMPLEMENTO'
            });
            await model.insertProviderLink({
                subscriptionId: first.subscription.id,
                provider: 'MERCADO_PAGO',
                providerId: 'unique-provider-id',
                tx
            });
            for (const duplicate of [
                {
                    subscriptionId: first.subscription.id,
                    providerId: 'another-id',
                    constraint: 'uq_provider_link_subscription'
                },
                {
                    subscriptionId: second.subscription.id,
                    providerId: 'unique-provider-id',
                    constraint: 'uq_provider_link_provider_id'
                }
            ]) {
                let failure: unknown;
                try {
                    await tx.transaction(async (savepoint) => {
                        await model.insertProviderLink({
                            subscriptionId: duplicate.subscriptionId,
                            provider: 'MERCADO_PAGO',
                            providerId: duplicate.providerId,
                            tx: savepoint as DrizzleClient
                        });
                    });
                } catch (error) {
                    failure = error;
                }
                expect(postgresCause(failure)).toMatchObject({
                    code: '23505',
                    constraint: duplicate.constraint
                });
            }

            const tombstone = await model.insertReceiptTombstone({ tx });
            expect(tombstone).toMatchObject({
                class: 'LAPIDA',
                status: 'CANCELLED',
                userId: null,
                vertical: null,
                planVersionId: null,
                billingOptionId: null,
                paymentMethod: null
            });
            const link = await model.insertProviderLink({
                subscriptionId: tombstone.id,
                provider: 'MERCADO_PAGO',
                providerId: 'receipt-tombstone',
                tx
            });
            expect(link.subscriptionId).toBe(tombstone.id);
        });

        let failure: unknown;
        try {
            await getTestDb().transaction(async (tx) => {
                const tombstone = await model.insertReceiptTombstone({
                    tx: tx as unknown as DrizzleClient
                });
                await tx.execute(sql`SET CONSTRAINTS ALL IMMEDIATE`);
                expect(tombstone.class).toBe('LAPIDA');
            });
        } catch (error) {
            failure = error;
        }
        expect(postgresCause(failure)).toMatchObject({
            code: '23514',
            constraint: 'ck_subscription_tombstone_provider_link'
        });
    });

    describe('cancellation retry population (HOS-1603, AC:B11:6)', () => {
        async function decide(args: {
            readonly tx: DrizzleClient;
            readonly subscriptionId: string;
            readonly transition: string;
            readonly decidedAt: Date;
        }) {
            return domainEventModel.insert({
                eventType: 'subscription.provider_cancellation_decided',
                entityType: 'subscription',
                entityId: args.subscriptionId,
                actorType: 'job',
                correlationId: crypto.randomUUID(),
                reason: args.transition,
                occurredAt: args.decidedAt,
                tx: args.tx
            });
        }

        it('the CHECK accepts the new event type and still rejects an invented one', async () => {
            await withTestTransaction(async (tx) => {
                const written = await decide({
                    tx,
                    subscriptionId: crypto.randomUUID(),
                    transition: 'S3',
                    decidedAt: new Date('2026-10-01T00:00:00.000Z')
                });
                expect(written.eventType).toBe('subscription.provider_cancellation_decided');

                let failure: unknown;
                try {
                    await tx.transaction(async (savepoint) => {
                        await savepoint.insert(domainEvent).values({
                            eventType: 'subscription.invented' as never,
                            entityType: 'subscription',
                            entityId: crypto.randomUUID(),
                            actorType: 'job',
                            correlationId: crypto.randomUUID()
                        });
                    });
                } catch (error) {
                    failure = error;
                }
                expect(postgresCause(failure)).toMatchObject({
                    code: '23514',
                    constraint: 'domain_event_event_type_check'
                });
            });
        });

        it('lists only terminal linked rows with a decision, each with its most recent one, by keyset', async () => {
            await withTestTransaction(async (tx) => {
                const anchors = await anchor(tx);
                const early = new Date('2026-10-01T00:00:00.000Z');
                const late = new Date('2026-10-02T00:00:00.000Z');
                const expected = new Map<string, { transition: string; decidedAt: Date }>();
                for (const status of ['CANCELLED', 'ABANDONED', 'CHARGE_DECLINED']) {
                    const row = await addSubscription({ tx, anchors, status, linked: true });
                    await decide({
                        tx,
                        subscriptionId: row.subscription.id,
                        transition: 'S16',
                        decidedAt: early
                    });
                    expected.set(row.subscription.id, { transition: 'S16', decidedAt: early });
                }
                const twice = await addSubscription({
                    tx,
                    anchors,
                    status: 'CANCELLED',
                    class: 'COMPLEMENTO',
                    linked: true
                });
                await decide({
                    tx,
                    subscriptionId: twice.subscription.id,
                    transition: 'A3',
                    decidedAt: early
                });
                await decide({
                    tx,
                    subscriptionId: twice.subscription.id,
                    transition: 'S21',
                    decidedAt: late
                });
                expected.set(twice.subscription.id, { transition: 'S21', decidedAt: late });
                const tombstone = await model.insertReceiptTombstone({ tx });
                await model.insertProviderLink({
                    subscriptionId: tombstone.id,
                    provider: 'MERCADO_PAGO',
                    providerId: `tombstone-${crypto.randomUUID()}`,
                    tx
                });
                await decide({
                    tx,
                    subscriptionId: tombstone.id,
                    transition: 'RECEPTION_TOMBSTONE',
                    decidedAt: early
                });
                expected.set(tombstone.id, { transition: 'RECEPTION_TOMBSTONE', decidedAt: early });

                const excluded: string[] = [];
                const liveWithDecision = await addSubscription({
                    tx,
                    anchors,
                    status: 'CANCEL_SCHEDULED',
                    linked: true
                });
                await decide({
                    tx,
                    subscriptionId: liveWithDecision.subscription.id,
                    transition: 'S11',
                    decidedAt: early
                });
                excluded.push(liveWithDecision.subscription.id);
                const terminalWithoutDecision = await addSubscription({
                    tx,
                    anchors,
                    status: 'CANCELLED',
                    linked: true
                });
                excluded.push(terminalWithoutDecision.subscription.id);
                const terminalWithoutLink = await addSubscription({
                    tx,
                    anchors,
                    status: 'ABANDONED',
                    linked: false
                });
                await decide({
                    tx,
                    subscriptionId: terminalWithoutLink.subscription.id,
                    transition: 'S3',
                    decidedAt: early
                });
                excluded.push(terminalWithoutLink.subscription.id);
                const mine = new Set([...expected.keys(), ...excluded]);

                const seen: string[] = [];
                let afterSubscriptionId: string | undefined;
                while (true) {
                    const page = await model.listCancellationRetryPage({
                        afterSubscriptionId,
                        limit: 2,
                        tx
                    });
                    if (page.length === 0) break;
                    for (const row of page) {
                        if (!mine.has(row.subscription.id)) continue;
                        seen.push(row.subscription.id);
                        const wanted = expected.get(row.subscription.id);
                        expect(row.providerLink.subscriptionId).toBe(row.subscription.id);
                        expect(row.decision.transition).toBe(wanted?.transition);
                        expect(row.decision.decidedAt.toISOString()).toBe(
                            wanted?.decidedAt.toISOString()
                        );
                    }
                    afterSubscriptionId = page.at(-1)?.subscription.id;
                }
                expect(seen).toEqual([...expected.keys()].sort());
                expect(new Set(seen).size).toBe(seen.length);
                for (const id of excluded) expect(seen).not.toContain(id);
            });
        });

        it('findCancellationDecision returns the most recent decision, or null without one', async () => {
            await withTestTransaction(async (tx) => {
                const anchors = await anchor(tx);
                const row = await addSubscription({
                    tx,
                    anchors,
                    status: 'CANCEL_SCHEDULED',
                    linked: true
                });
                expect(
                    await model.findCancellationDecision({
                        subscriptionId: row.subscription.id,
                        tx
                    })
                ).toBeNull();
                await decide({
                    tx,
                    subscriptionId: row.subscription.id,
                    transition: 'S11',
                    decidedAt: new Date('2026-10-01T00:00:00.000Z')
                });
                const newest = await decide({
                    tx,
                    subscriptionId: row.subscription.id,
                    transition: 'S11',
                    decidedAt: new Date('2026-10-03T00:00:00.000Z')
                });
                expect(
                    await model.findCancellationDecision({
                        subscriptionId: row.subscription.id,
                        tx
                    })
                ).toEqual({
                    eventId: newest.id,
                    transition: 'S11',
                    decidedAt: new Date('2026-10-03T00:00:00.000Z')
                });
            });
        });
    });
});
