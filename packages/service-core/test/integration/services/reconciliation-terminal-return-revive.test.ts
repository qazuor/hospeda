/** TEST:B11:14 (d) — a rejection terminal revived by the provider gets S16 from the sweep. */
import {
    and,
    domainEvent,
    domainEventModel,
    emailOutbox,
    eq,
    inArray,
    isNull,
    providerLinks,
    reconciliationMarks,
    subscriptions
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPaymentReconciliationMarkPayments } from '../../../src/services/billing/payment/payment-ledger.js';
import { createPeriodChargesComparison } from '../../../src/services/billing/reconciliation/sweep/comparisons/period-charges-comparison.js';
import { createStateComparison } from '../../../src/services/billing/reconciliation/sweep/comparisons/state-comparison.js';
import { runReconciliationSweep } from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';
import { providerLinkCancellationSeen } from '../../../src/services/billing/subscription/provider-link-cancellation-seen.js';
import type { BeforeCancelNotice } from '../../../src/services/billing/subscription/start-subscription.service.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import {
    resetSeededReconciliationInventory,
    withSeededCancellationRetryInventory,
    withSeededReconciliationInventory
} from './reconciliation-sweep-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';
import {
    resetSeededTerminalReturnInventory,
    seedTerminalRow,
    withSeededTerminalReturnInventory
} from './support/terminal-return-fixtures.js';

const DAY = 86_400_000;
const T0 = new Date('2026-11-01T10:00:00.000Z');
let current = new Date(T0);
const clock = { now: () => new Date(current) };
const ids = new Set<string>();
const AFTER_REJECTION = 'subscription.provider_cancelled_after_rejection';
const DECIDED = 'subscription.provider_cancellation_decided';

beforeAll(() => getServiceTestDb());
afterAll(closeServiceTestPool);
beforeEach(() => {
    current = new Date(T0);
    ids.clear();
    resetSeededReconciliationInventory();
    resetSeededTerminalReturnInventory();
    vi.restoreAllMocks();
});
afterEach(async () => {
    const owned = [...ids];
    if (owned.length === 0) return;
    const db = getServiceTestDb();
    const rows = await db
        .select({ id: subscriptions.id, userId: subscriptions.userId })
        .from(subscriptions)
        .where(inArray(subscriptions.id, owned));
    const userIds = [
        ...new Set(rows.map(({ userId }) => userId).filter((id): id is string => id !== null))
    ];
    for (const row of rows)
        await db
            .update(reconciliationMarks)
            .set({ liftedAt: new Date(), liftedBy: row.userId })
            .where(
                and(
                    eq(reconciliationMarks.subscriptionId, row.id),
                    isNull(reconciliationMarks.liftedAt)
                )
            );
    await db.delete(providerLinks).where(inArray(providerLinks.subscriptionId, owned));
    await db
        .update(subscriptions)
        .set({ status: 'CANCELLED' })
        .where(inArray(subscriptions.id, owned));
    if (userIds.length > 0)
        await db.delete(emailOutbox).where(inArray(emailOutbox.recipientUserId, userIds));
});

function newFake() {
    const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
    return { fake, provider: fake as unknown as PaymentProvider };
}

async function runSweep(
    fake: FakePaymentProvider,
    beforeCancelNotice: BeforeCancelNotice = outboxBeforeCancelNotice({ deliver: true })
) {
    return withSeededReconciliationInventory(() =>
        withSeededCancellationRetryInventory(() =>
            withSeededTerminalReturnInventory(() =>
                runReconciliationSweep(
                    { correlationId: crypto.randomUUID() },
                    {
                        provider: fake as unknown as PaymentProvider,
                        clock,
                        comparisons: [
                            createStateComparison(),
                            createPeriodChargesComparison({
                                provider: fake as unknown as PaymentProvider
                            })
                        ],
                        markPayments: createPaymentReconciliationMarkPayments(clock),
                        cancellationRetry: { beforeCancelNotice },
                        terminalReturn: { beforeCancelNotice },
                        cancellationSeen: providerLinkCancellationSeen,
                        livenessPing: { ping: vi.fn() }
                    }
                )
            )
        )
    );
}

async function seedMirrorAfterRejection(subscriptionId: string) {
    await domainEventModel.insert({
        eventType: AFTER_REJECTION,
        entityType: 'subscription',
        entityId: subscriptionId,
        actorType: 'provider',
        actorId: null,
        correlationId: crypto.randomUUID(),
        changes: [],
        reason: null,
        occurredAt: T0
    });
}

describe('TEST:B11:14 provider rejection revival', () => {
    it('TEST:B11:14 (d) sends S16 before cancel, retries days 5–6, marks on day 7 and compares the stopped row on day 8', async () => {
        const { fake } = newFake();
        const row = await seedTerminalRow({ status: 'CHARGE_DECLINED', fake });
        ids.add(row.subscription.id);
        await getServiceTestDb()
            .update(providerLinks)
            .set({ cancelledSeenAt: T0 })
            .where(eq(providerLinks.subscriptionId, row.subscription.id));
        const events: string[] = [];
        const actualNotice = outboxBeforeCancelNotice({ deliver: true });
        const beforeCancel = vi.fn(
            async (input: Parameters<typeof actualNotice.beforeCancel>[0]) => {
                events.push('notice');
                return actualNotice.beforeCancel(input);
            }
        );
        const noticePort = { beforeCancel };
        const cancel = vi.spyOn(fake, 'cancel').mockImplementation(async () => {
            events.push('cancel');
            throw new Error('provider timeout');
        });
        const runAt = async (day: number) => {
            current = new Date(T0.getTime() + day * DAY);
            const result = await withSeededReconciliationInventory(() =>
                withSeededCancellationRetryInventory(() =>
                    withSeededTerminalReturnInventory(() =>
                        runReconciliationSweep(
                            { correlationId: crypto.randomUUID() },
                            {
                                provider: fake as unknown as PaymentProvider,
                                clock,
                                comparisons: [
                                    createStateComparison(),
                                    createPeriodChargesComparison({
                                        provider: fake as unknown as PaymentProvider
                                    })
                                ],
                                markPayments: createPaymentReconciliationMarkPayments(clock),
                                cancellationRetry: { beforeCancelNotice: noticePort },
                                terminalReturn: { beforeCancelNotice: noticePort },
                                cancellationSeen: providerLinkCancellationSeen,
                                livenessPing: { ping: vi.fn() }
                            }
                        )
                    )
                )
            );
            return result;
        };

        current = new Date(T0.getTime() + 4 * DAY);
        const day4 = await runAt(4);
        expect(day4.terminalReturn?.handled.cancellationSent).toBe(1);
        expect(events.slice(0, 2)).toEqual(['notice', 'cancel']);
        const decisions = await getServiceTestDb()
            .select({ reason: domainEvent.reason, occurredAt: domainEvent.occurredAt })
            .from(domainEvent)
            .where(
                and(
                    eq(domainEvent.entityType, 'subscription'),
                    eq(domainEvent.entityId, row.subscription.id),
                    eq(domainEvent.eventType, DECIDED)
                )
            );
        expect(decisions).toContainEqual({ reason: 'REJECTION_REVIVED', occurredAt: current });
        expect(
            (
                await getServiceTestDb()
                    .select({ value: providerLinks.cancelledSeenAt })
                    .from(providerLinks)
                    .where(eq(providerLinks.subscriptionId, row.subscription.id))
            )[0]?.value
        ).toBeNull();

        for (const day of [5, 6]) {
            const result = await runAt(day);
            expect(result.cancellationRetry?.callFailed).toBe(1);
        }
        const day7 = await runAt(7);
        expect(day7.cancellationRetry?.marked).toBe(1);
        expect(cancel).toHaveBeenCalledTimes(3);
        const comparisons = vi.fn();
        current = new Date(T0.getTime() + 8 * DAY);
        const portsNotice = outboxBeforeCancelNotice({ deliver: true });
        const day8 = await withSeededReconciliationInventory(() =>
            withSeededCancellationRetryInventory(() =>
                withSeededTerminalReturnInventory(() =>
                    runReconciliationSweep(
                        {},
                        {
                            provider: fake as unknown as PaymentProvider,
                            clock,
                            comparisons: [
                                async (input) => {
                                    comparisons();
                                    return createStateComparison()(input);
                                },
                                createPeriodChargesComparison({
                                    provider: fake as unknown as PaymentProvider
                                })
                            ],
                            cancellationRetry: { beforeCancelNotice: portsNotice },
                            terminalReturn: { beforeCancelNotice: portsNotice },
                            cancellationSeen: providerLinkCancellationSeen
                        }
                    )
                )
            )
        );
        expect(day8.terminalReturn?.handled.retried).toBe(1);
        expect(comparisons).toHaveBeenCalled();
        expect(cancel).toHaveBeenCalledTimes(3);
    });

    it('TEST:B11:14 (d mirror) applies the same revival to CANCELLED after provider rejection', async () => {
        const { fake } = newFake();
        const row = await seedTerminalRow({ status: 'CANCELLED', fake });
        ids.add(row.subscription.id);
        await seedMirrorAfterRejection(row.subscription.id);
        await getServiceTestDb()
            .update(providerLinks)
            .set({ cancelledSeenAt: T0 })
            .where(eq(providerLinks.subscriptionId, row.subscription.id));
        const order: string[] = [];
        const actualNotice = outboxBeforeCancelNotice({ deliver: true });
        const beforeCancel = vi.fn(
            async (input: Parameters<typeof actualNotice.beforeCancel>[0]) => {
                order.push('notice');
                return actualNotice.beforeCancel(input);
            }
        );
        const cancel = vi.spyOn(fake, 'cancel').mockImplementation(async () => {
            order.push('cancel');
            throw new Error('provider timeout');
        });
        current = new Date(T0.getTime() + 4 * DAY);
        const result = await runSweep(fake, { beforeCancel });
        expect(result.terminalReturn?.handled.cancellationSent).toBe(1);
        expect(order).toEqual(['notice', 'cancel']);
        expect(cancel).toHaveBeenCalledTimes(1);
        const decision = await getServiceTestDb()
            .select({ reason: domainEvent.reason })
            .from(domainEvent)
            .where(
                and(
                    eq(domainEvent.entityType, 'subscription'),
                    eq(domainEvent.entityId, row.subscription.id),
                    eq(domainEvent.eventType, DECIDED)
                )
            );
        expect(decision.map(({ reason }) => reason)).toContain('REJECTION_REVIVED');
    });
});
