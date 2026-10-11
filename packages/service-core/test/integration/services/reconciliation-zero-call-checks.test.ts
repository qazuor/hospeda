import {
    courtesyGrants,
    eq,
    inArray,
    payments,
    reconciliationMarkModel,
    subscriptions
} from '@repo/db';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { runReconciliationSweep } from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import {
    createReconciliationFake,
    reconciliationClock,
    retainedPaymentsDouble,
    seedDeferredCourtesy,
    seedRetainedPayment,
    seedSubscription,
    seedSuccession,
    withSeededZeroCallPopulations,
    zeroCallSubscriptionIds
} from './reconciliation-zero-call-fixtures.js';

afterAll(closeServiceTestPool);

const hang = async () => {};
const markPayments = { hang, countUnresolved: async () => 0 };

describe('TEST:B11:18 seeded zero-call checks', () => {
    it('resolves a branch, opens the three required marks and makes no provider calls', async () => {
        const succession = await seedSuccession('CANCELLED');
        const resolvedOwner = await seedSubscription({ status: 'CANCELLED' });
        const unresolvedOwner = await seedSubscription({ status: 'CANCELLED' });
        const resolvedPayment = await seedRetainedPayment(resolvedOwner.subscription.id);
        const unresolvedPayment = await seedRetainedPayment(unresolvedOwner.subscription.id);
        const courtesy = await seedDeferredCourtesy('ACTIVE');
        const { fake } = createReconciliationFake();
        const subscriptionIds = [
            succession.predecessor.id,
            succession.successor.id,
            resolvedOwner.subscription.id,
            unresolvedOwner.subscription.id,
            courtesy.predecessor.id,
            courtesy.successor.id
        ];
        const beforeSubscriptions = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(inArray(subscriptions.id, subscriptionIds));
        const beforePayments = await getServiceTestDb()
            .select()
            .from(payments)
            .where(inArray(payments.id, [resolvedPayment.id, unresolvedPayment.id]));
        const beforeCourtesies = await getServiceTestDb()
            .select()
            .from(courtesyGrants)
            .where(eq(courtesyGrants.id, courtesy.grant.id));
        let providerCalls = 0;
        const provider = new Proxy(fake, {
            get(target, key, receiver) {
                const value = Reflect.get(target, key, receiver) as unknown;
                if (typeof value !== 'function') return value;
                return (...args: unknown[]) => {
                    providerCalls++;
                    return value.apply(target, args);
                };
            }
        });
        const resolved: string[] = [];
        const branch = {
            resolveByBranch: async (input: { subscriptionId: string }) => {
                resolved.push(input.subscriptionId);
                return {
                    kind:
                        input.subscriptionId === resolvedOwner.subscription.id
                            ? ('RESOLVED' as const)
                            : ('NO_BRANCH' as const)
                };
            }
        };
        const hangSpy = vi.fn(async (..._args: unknown[]) => {});
        const summary = await withSeededZeroCallPopulations(() =>
            runReconciliationSweep(
                {},
                {
                    provider: provider as never,
                    clock: reconciliationClock,
                    zeroCallChecks: {
                        retainedPayments: retainedPaymentsDouble([
                            {
                                subscriptionId: resolvedOwner.subscription.id,
                                payment: { source: 'PAYMENT', id: resolvedPayment.id }
                            },
                            {
                                subscriptionId: unresolvedOwner.subscription.id,
                                payment: { source: 'PAYMENT', id: unresolvedPayment.id }
                            }
                        ]),
                        retainedPaymentBranches: branch
                    },
                    markPayments: { ...markPayments, hang: hangSpy }
                }
            )
        );
        expect(providerCalls).toBe(0);
        expect(resolved).toEqual([resolvedOwner.subscription.id, unresolvedOwner.subscription.id]);
        const successionMarks = await reconciliationMarkModel.listOpen({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: succession.successor.id }
        });
        const unresolvedMarks = await reconciliationMarkModel.listOpen({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: unresolvedOwner.subscription.id }
        });
        const courtesyMarks = await reconciliationMarkModel.listOpen({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: courtesy.successor.id }
        });
        expect(successionMarks.map(({ reason }) => reason)).toContain(
            'SUCESION_ABIERTA_SOBRE_FILA_MUERTA'
        );
        expect(unresolvedMarks.map(({ reason }) => reason)).toContain('PAGO_PENDIENTE_SIN_RAMA');
        expect(courtesyMarks.map(({ reason }) => reason)).toContain('CORTESIA_SIN_RE_EMITIR');
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: resolvedOwner.subscription.id }
            })
        ).toEqual([]);
        expect(hangSpy).toHaveBeenCalledTimes(1);
        expect(hangSpy.mock.calls[0]?.[0]).toMatchObject({
            payment: { id: unresolvedPayment.id, source: 'PAYMENT' },
            markId: unresolvedMarks[0]?.id
        });
        expect(summary.zeroCallChecks?.failures).toEqual([]);
        expect(
            await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(inArray(subscriptions.id, subscriptionIds))
        ).toEqual(beforeSubscriptions);
        expect(
            await getServiceTestDb()
                .select()
                .from(payments)
                .where(inArray(payments.id, [resolvedPayment.id, unresolvedPayment.id]))
        ).toEqual(beforePayments);
        expect(
            await getServiceTestDb()
                .select()
                .from(courtesyGrants)
                .where(eq(courtesyGrants.id, courtesy.grant.id))
        ).toEqual(beforeCourtesies);

        for (const id of subscriptionIds) zeroCallSubscriptionIds.add(id);
        const again = await withSeededZeroCallPopulations(() =>
            runReconciliationSweep(
                {},
                {
                    provider: provider as never,
                    clock: reconciliationClock,
                    zeroCallChecks: {
                        retainedPayments: retainedPaymentsDouble([
                            {
                                subscriptionId: resolvedOwner.subscription.id,
                                payment: { source: 'PAYMENT', id: resolvedPayment.id }
                            },
                            {
                                subscriptionId: unresolvedOwner.subscription.id,
                                payment: { source: 'PAYMENT', id: unresolvedPayment.id }
                            }
                        ]),
                        retainedPaymentBranches: branch
                    },
                    markPayments
                }
            )
        );
        expect(
            again.zeroCallChecks?.results.reduce((n, item) => n + item.marksAccumulated, 0)
        ).toBe(3);
        expect(again.zeroCallChecks?.results.reduce((n, item) => n + item.marksOpened, 0)).toBe(0);
    });

    it('isolates missing ports and continues the first and sixth checks', async () => {
        const succession = await seedSuccession('CANCELLED');
        const courtesy = await seedDeferredCourtesy();
        const summary = await withSeededZeroCallPopulations(() =>
            runReconciliationSweep(
                {},
                {
                    provider: createReconciliationFake().provider,
                    clock: reconciliationClock,
                    zeroCallChecks: {}
                }
            )
        );
        expect(summary.zeroCallChecks?.failures).toHaveLength(1);
        expect(summary.zeroCallChecks?.failures[0]).toMatchObject({
            check: 'PAYMENT_PENDING_WITHOUT_BRANCH',
            subjectId: null
        });
        expect(summary.zeroCallChecks?.failures[0]?.message).toContain(
            'RETAINED_PAYMENTS_PORT_NOT_REGISTERED'
        );
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: succession.successor.id }
            })
        ).toHaveLength(1);
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: courtesy.successor.id }
            })
        ).toHaveLength(1);
    });

    it('does not mark live predecessors, abandoned successors, closed or grace courtesies, or live successor payments', async () => {
        const livePairs = await Promise.all(
            [
                'PENDING_AUTHORIZATION',
                'ACTIVE',
                'GRACE_PERIOD',
                'PAUSED',
                'SUSPENDED',
                'CANCEL_SCHEDULED'
            ].map((status) => seedSuccession(status))
        );
        const abandoned = await seedSuccession('CANCELLED', 'ABANDONED');
        const closedCourtesy = await seedDeferredCourtesy('ACTIVE', 0);
        await getServiceTestDb()
            .update(courtesyGrants)
            .set({
                balanceClosedAt: new Date('2026-10-01T00:00:00.000Z'),
                closeReason: 'GRANT_PERMANENTE_OTORGADO'
            })
            .where(eq(courtesyGrants.id, closedCourtesy.grant.id));
        const graceCourtesy = await seedDeferredCourtesy('GRACE_PERIOD', 2);
        const retained = await seedSuccession('CANCELLED', 'ACTIVE');
        const pendingPayment = await seedRetainedPayment(retained.predecessor.id);
        let branchCalls = 0;
        const summary = await withSeededZeroCallPopulations(() =>
            runReconciliationSweep(
                {},
                {
                    provider: createReconciliationFake().provider,
                    clock: reconciliationClock,
                    zeroCallChecks: {
                        retainedPayments: retainedPaymentsDouble([
                            {
                                subscriptionId: retained.predecessor.id,
                                payment: { source: 'PAYMENT', id: pendingPayment.id }
                            }
                        ]),
                        retainedPaymentBranches: {
                            resolveByBranch: async () => {
                                branchCalls++;
                                return { kind: 'RESOLVED' };
                            }
                        }
                    }
                }
            )
        );
        expect(summary.zeroCallChecks?.failures).toEqual([]);
        expect(branchCalls).toBe(0);
        for (const pair of livePairs)
            expect(
                await reconciliationMarkModel.listOpen({
                    subject: { kind: 'SUBSCRIPTION', subscriptionId: pair.successor.id }
                })
            ).toEqual([]);
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: abandoned.successor.id }
            })
        ).toEqual([]);
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: closedCourtesy.successor.id }
            })
        ).toEqual([]);
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: graceCourtesy.successor.id }
            })
        ).toEqual([]);
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: retained.predecessor.id }
            })
        ).toEqual([]);
    });

    it('reports a missing branch resolver against each eligible payment and continues the list', async () => {
        const first = await seedSubscription({ status: 'CANCELLED' });
        const second = await seedSubscription({ status: 'CANCELLED' });
        const p1 = await seedRetainedPayment(first.subscription.id);
        const p2 = await seedRetainedPayment(second.subscription.id);
        const summary = await withSeededZeroCallPopulations(() =>
            runReconciliationSweep(
                {},
                {
                    provider: createReconciliationFake().provider,
                    clock: reconciliationClock,
                    zeroCallChecks: {
                        retainedPayments: retainedPaymentsDouble([
                            {
                                subscriptionId: first.subscription.id,
                                payment: { source: 'PAYMENT', id: p1.id }
                            },
                            {
                                subscriptionId: second.subscription.id,
                                payment: { source: 'PAYMENT', id: p2.id }
                            }
                        ])
                    }
                }
            )
        );
        expect(summary.zeroCallChecks?.failures).toHaveLength(2);
        expect(summary.zeroCallChecks?.failures.map(({ subjectId }) => subjectId)).toEqual([
            first.subscription.id,
            second.subscription.id
        ]);
        expect(
            summary.zeroCallChecks?.failures.every(({ message }) =>
                message.includes('RETAINED_PAYMENT_BRANCH_PORT_NOT_REGISTERED')
            )
        ).toBe(true);
    });

    it('is opt-in and does not add zero-call marks when omitted', async () => {
        const succession = await seedSuccession('CANCELLED');
        const { fake } = createReconciliationFake();
        const summary = await withSeededZeroCallPopulations(() =>
            runReconciliationSweep({}, { provider: fake, clock: reconciliationClock })
        );
        expect(summary.zeroCallChecks).toBeUndefined();
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: succession.successor.id }
            })
        ).toEqual([]);
    });
});
