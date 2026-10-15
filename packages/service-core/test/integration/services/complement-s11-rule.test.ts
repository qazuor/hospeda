import {
    and,
    domainEventModel,
    eq,
    isNull,
    providerLinks,
    reconciliationMarks,
    subscriptions
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service.js';
import { retryOurCancellation } from '../../../src/services/billing/reconciliation/sweep/our-cancellation-retry.js';
import {
    cancelComplementsByS11Rule,
    cancelDecidedComplementsAtProvider
} from '../../../src/services/billing/subscription/complement-s11-rule.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    complementNow,
    providerHarness,
    retireComplementRows,
    seedCommittedComplement
} from './support/complement-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';

const clock = { now: () => complementNow };
afterEach(retireComplementRows);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-1562 TEST:B7:8 AC:B7:14 la regla de S11 sobre los complementos',
    () => {
        it('cancela scopes vertical/listing, deja USER con otro título, registra decisiones y conserva marca 22', async () => {
            const harness = providerHarness();
            const seeded = await seedCommittedComplement({
                fake: harness.fake,
                principalStatus: 'ACTIVE',
                otherStatus: 'ACTIVE',
                scopeTypes: ['VERTICAL_SUBSCRIPTION', 'LISTING', 'USER']
            });
            const serviceEndsAt = new Date('2026-12-01T00:00:00.000Z');
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'CANCEL_SCHEDULED', serviceEndsAt })
                .where(eq(subscriptions.id, seeded.principalId));
            await getServiceTestDb().transaction(async (raw) => {
                const tx = raw;
                await openReconciliationMark({
                    subject: {
                        kind: 'SUBSCRIPTION',
                        subscriptionId: seeded.addons[0]!.complementId
                    },
                    reason: 'PAUSA_NO_APLICADA',
                    actor: { type: 'job' },
                    correlationId: crypto.randomUUID(),
                    tx
                });
            });
            const result = await getServiceTestDb().transaction(async (raw) =>
                cancelComplementsByS11Rule(
                    { tx: raw, principalSubscriptionId: seeded.principalId, now: complementNow },
                    seeded.policy
                )
            );
            expect(result.decided).toHaveLength(2);
            const rows = await getServiceTestDb()
                .select({
                    id: subscriptions.id,
                    status: subscriptions.status,
                    end: subscriptions.serviceEndsAt
                })
                .from(subscriptions)
                .where(eq(subscriptions.userId, seeded.userId));
            for (const addon of seeded.addons.slice(0, 2)) {
                const row = rows.find((candidate) => candidate.id === addon.complementId);
                expect(row).toMatchObject({ status: 'CANCEL_SCHEDULED', end: serviceEndsAt });
                const events = await domainEventModel.findByEntity({
                    entityType: 'subscription',
                    entityId: addon.complementId
                });
                expect(
                    events
                        .filter(
                            (event) =>
                                event.eventType === 'subscription.provider_cancellation_decided'
                        )
                        .map((event) => event.reason)
                ).toContain('S11');
            }
            expect(rows.find((row) => row.id === seeded.addons[2]?.complementId)?.status).toBe(
                'ACTIVE'
            );
            const marks = await getServiceTestDb()
                .select()
                .from(reconciliationMarks)
                .where(
                    and(
                        eq(reconciliationMarks.subscriptionId, seeded.addons[0]!.complementId),
                        eq(reconciliationMarks.reason, 'PAUSA_NO_APLICADA'),
                        isNull(reconciliationMarks.liftedAt)
                    )
                );
            expect(marks).toHaveLength(1);
        });

        it('USER usa la fecha más tardía de principales compatibles ya canceladas', async () => {
            const harness = providerHarness();
            const seeded = await seedCommittedComplement({
                fake: harness.fake,
                principalStatus: 'ACTIVE',
                otherStatus: 'ACTIVE',
                scopeType: 'USER'
            });
            const earlier = new Date('2026-11-01T00:00:00.000Z');
            const later = new Date('2027-01-01T00:00:00.000Z');
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'CANCEL_SCHEDULED', serviceEndsAt: earlier })
                .where(eq(subscriptions.id, seeded.principalId));
            if (!seeded.otherPrincipalId) throw new Error('other principal missing');
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'CANCEL_SCHEDULED', serviceEndsAt: later })
                .where(eq(subscriptions.id, seeded.otherPrincipalId));
            await getServiceTestDb().transaction(async (raw) => {
                await cancelComplementsByS11Rule(
                    { tx: raw, principalSubscriptionId: seeded.principalId, now: complementNow },
                    seeded.policy
                );
            });
            const [row] = await getServiceTestDb()
                .select({ status: subscriptions.status, end: subscriptions.serviceEndsAt })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.complementId));
            expect(row).toEqual({ status: 'CANCEL_SCHEDULED', end: later });
        });

        it('excluye complementos PAUSED y CANCELLED y falla cerrado si la principal no está programada', async () => {
            const harness = providerHarness();
            const paused = await seedCommittedComplement({
                fake: harness.fake,
                principalStatus: 'CANCEL_SCHEDULED',
                scopeType: 'VERTICAL_SUBSCRIPTION',
                complementStatus: 'PAUSED',
                openPause: true
            });
            const [principal] = await getServiceTestDb()
                .select({ serviceEndsAt: subscriptions.serviceEndsAt })
                .from(subscriptions)
                .where(eq(subscriptions.id, paused.principalId));
            await getServiceTestDb()
                .update(subscriptions)
                .set({ serviceEndsAt: principal?.serviceEndsAt ?? complementNow })
                .where(eq(subscriptions.id, paused.principalId));
            const result = await getServiceTestDb().transaction(async (raw) =>
                cancelComplementsByS11Rule(
                    { tx: raw, principalSubscriptionId: paused.principalId, now: complementNow },
                    paused.policy
                )
            );
            expect(result).toEqual({ decided: [] });
            const [row] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, paused.complementId));
            expect(row?.status).toBe('PAUSED');
            const cancelled = await seedCommittedComplement({
                fake: harness.fake,
                principalStatus: 'CANCEL_SCHEDULED',
                scopeType: 'VERTICAL_SUBSCRIPTION',
                complementStatus: 'CANCELLED'
            });
            await getServiceTestDb()
                .update(subscriptions)
                .set({ serviceEndsAt: complementNow })
                .where(eq(subscriptions.id, cancelled.principalId));
            const cancelledResult = await getServiceTestDb().transaction(async (raw) =>
                cancelComplementsByS11Rule(
                    { tx: raw, principalSubscriptionId: cancelled.principalId, now: complementNow },
                    cancelled.policy
                )
            );
            expect(cancelledResult).toEqual({ decided: [] });
            await expect(
                getServiceTestDb().transaction(async (raw) =>
                    cancelComplementsByS11Rule(
                        {
                            tx: raw,
                            principalSubscriptionId: paused.complementId,
                            now: complementNow
                        },
                        paused.policy
                    )
                )
            ).rejects.toThrow();
        });

        it('cancela con correo previo, deja NOTICE_PENDING y FAILED reintentable, y retry usa SCHEDULED_CANCELLATION', async () => {
            const harness = providerHarness();
            const seeded = await seedCommittedComplement({
                fake: harness.fake,
                principalStatus: 'ACTIVE',
                scopeType: 'VERTICAL_SUBSCRIPTION'
            });
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'CANCEL_SCHEDULED', serviceEndsAt: complementNow })
                .where(eq(subscriptions.id, seeded.principalId));
            const { decided } = await getServiceTestDb().transaction(async (raw) =>
                cancelComplementsByS11Rule(
                    { tx: raw, principalSubscriptionId: seeded.principalId, now: complementNow },
                    seeded.policy
                )
            );
            const order: string[] = [];
            const cancel = vi.fn<PaymentProvider['cancel']>(async ({ authorizationId }) => {
                order.push('cancel');
                return harness.fake.cancel({ authorizationId });
            });
            const provider = new Proxy(harness.provider, {
                get(target, property, receiver) {
                    if (property === 'cancel') return cancel;
                    const method = Reflect.get(target, property, receiver);
                    return typeof method === 'function' ? method.bind(target) : method;
                }
            }) as PaymentProvider;
            const delivered = outboxBeforeCancelNotice({ deliver: true });
            const sent = await cancelDecidedComplementsAtProvider(
                { decided },
                {
                    provider,
                    clock,
                    beforeCancelNotice: {
                        beforeCancel: async (args) => {
                            order.push('notice');
                            return delivered.beforeCancel(args);
                        }
                    }
                }
            );
            expect(sent.results[0]?.cancelCall).toBe('SENT');
            expect(order).toEqual(['notice', 'cancel']);
            expect(cancel).toHaveBeenCalledTimes(1);
            const pendingHarness = providerHarness();
            const pendingSeed = await seedCommittedComplement({
                fake: pendingHarness.fake,
                principalStatus: 'ACTIVE',
                scopeType: 'VERTICAL_SUBSCRIPTION'
            });
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'CANCEL_SCHEDULED', serviceEndsAt: complementNow })
                .where(eq(subscriptions.id, pendingSeed.principalId));
            const pendingDecision = await getServiceTestDb().transaction(async (raw) =>
                cancelComplementsByS11Rule(
                    {
                        tx: raw,
                        principalSubscriptionId: pendingSeed.principalId,
                        now: complementNow
                    },
                    pendingSeed.policy
                )
            );
            const pending = await cancelDecidedComplementsAtProvider(pendingDecision, {
                provider: pendingHarness.provider,
                clock,
                beforeCancelNotice: outboxBeforeCancelNotice()
            });
            expect(pending.results[0]?.cancelCall).toBe('NOTICE_PENDING');
            const [stillScheduled] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, pendingSeed.complementId));
            expect(stillScheduled?.status).toBe('CANCEL_SCHEDULED');
            const failingHarness = providerHarness();
            const failingSeed = await seedCommittedComplement({
                fake: failingHarness.fake,
                principalStatus: 'ACTIVE',
                scopeType: 'VERTICAL_SUBSCRIPTION'
            });
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'CANCEL_SCHEDULED', serviceEndsAt: complementNow })
                .where(eq(subscriptions.id, failingSeed.principalId));
            const failingDecision = await getServiceTestDb().transaction(async (raw) =>
                cancelComplementsByS11Rule(
                    {
                        tx: raw,
                        principalSubscriptionId: failingSeed.principalId,
                        now: complementNow
                    },
                    failingSeed.policy
                )
            );
            const failingProvider = new Proxy(failingHarness.provider, {
                get(target, property, receiver) {
                    if (property === 'cancel')
                        return async () => {
                            throw new Error('cancel failed');
                        };
                    const method = Reflect.get(target, property, receiver);
                    return typeof method === 'function' ? method.bind(target) : method;
                }
            }) as PaymentProvider;
            const failed = await cancelDecidedComplementsAtProvider(failingDecision, {
                provider: failingProvider,
                clock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' }
            });
            expect(failed.results[0]?.cancelCall).toBe('FAILED');
            const [failedRow] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, failingSeed.complementId));
            expect(failedRow?.status).toBe('CANCEL_SCHEDULED');
            const [row] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, pendingSeed.complementId));
            const [link] = await getServiceTestDb()
                .select()
                .from(providerLinks)
                .where(eq(providerLinks.subscriptionId, pendingSeed.complementId));
            if (!row || !link) throw new Error('retry rows missing');
            let requestedKind: string | undefined;
            await retryOurCancellation(
                {
                    subscription: row,
                    providerLink: link,
                    decision: { transition: 'S11', decidedAt: complementNow },
                    correlationId: crypto.randomUUID()
                },
                {
                    provider: pendingHarness.provider,
                    clock,
                    beforeCancelNotice: {
                        beforeCancel: async (args) => {
                            requestedKind = args.kind;
                            return 'SENT';
                        }
                    }
                }
            );
            expect(requestedKind).toBe('SCHEDULED_CANCELLATION');
        });
    }
);
