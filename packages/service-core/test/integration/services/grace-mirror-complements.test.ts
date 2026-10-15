import { and, domainEventModel, eq, isNull, reconciliationMarks, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { mirrorOurCancellationOnActive } from '../../../src/services/billing/notice/mirror-our-cancellation-on-active.js';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service.js';
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
    'HOS-1562 TEST:B7:8 AC:B7:14 el espejo de R18 cancela los complementos',
    () => {
        it('programa principal y complementos en el mismo tx y cancela después del commit sin levantar la marca 22', async () => {
            const harness = providerHarness();
            const seeded = await seedCommittedComplement({
                fake: harness.fake,
                principalStatus: 'ACTIVE',
                scopeType: 'VERTICAL_SUBSCRIPTION'
            });
            const principalNotice = outboxBeforeCancelNotice({ deliver: true });
            await principalNotice.beforeCancel({
                subscriptionId: seeded.principalId,
                userId: seeded.userId,
                kind: 'ARREARS_SUSPENSION'
            });
            await getServiceTestDb().transaction(async (tx) =>
                openReconciliationMark({
                    subject: { kind: 'SUBSCRIPTION', subscriptionId: seeded.complementId },
                    reason: 'PAUSA_NO_APLICADA',
                    actor: { type: 'job' },
                    correlationId: crypto.randomUUID(),
                    tx
                })
            );
            let principalStatusDuringComplementNotice: string | undefined;
            const complementNotice = outboxBeforeCancelNotice({ deliver: true });
            const result = await mirrorOurCancellationOnActive(
                { subscriptionId: seeded.principalId, readAt: complementNow, everyMonths: 1 },
                {
                    clock,
                    complements: seeded.policy,
                    provider: harness.provider,
                    beforeCancelNotice: {
                        beforeCancel: async (args) => {
                            const [principal] = await getServiceTestDb()
                                .select({ status: subscriptions.status })
                                .from(subscriptions)
                                .where(eq(subscriptions.id, seeded.principalId));
                            principalStatusDuringComplementNotice = principal?.status;
                            return complementNotice.beforeCancel(args);
                        }
                    }
                }
            );
            expect(result.outcome).toBe('SCHEDULED');
            const [main] = await getServiceTestDb()
                .select({ status: subscriptions.status, end: subscriptions.serviceEndsAt })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.principalId));
            const [complement] = await getServiceTestDb()
                .select({ status: subscriptions.status, end: subscriptions.serviceEndsAt })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.complementId));
            expect(main?.status).toBe('CANCEL_SCHEDULED');
            expect(principalStatusDuringComplementNotice).toBe('CANCEL_SCHEDULED');
            expect(complement).toEqual({ status: 'CANCEL_SCHEDULED', end: main?.end });
            expect(
                (await harness.fake.readAuthorization({ authorizationId: seeded.authorizationId! }))
                    .snapshot.status
            ).toBe('cancelled');
            const marks = await getServiceTestDb()
                .select()
                .from(reconciliationMarks)
                .where(
                    and(
                        eq(reconciliationMarks.subscriptionId, seeded.complementId),
                        eq(reconciliationMarks.reason, 'PAUSA_NO_APLICADA'),
                        isNull(reconciliationMarks.liftedAt)
                    )
                );
            expect(marks).toHaveLength(1);
        });

        it('hace rollback de R18 si la regla local falla y sin puerto conserva el comportamiento previo', async () => {
            const harness = providerHarness();
            const seeded = await seedCommittedComplement({
                fake: harness.fake,
                principalStatus: 'ACTIVE',
                scopeType: 'VERTICAL_SUBSCRIPTION'
            });
            const notice = outboxBeforeCancelNotice({ deliver: true });
            await notice.beforeCancel({
                subscriptionId: seeded.principalId,
                userId: seeded.userId,
                kind: 'ARREARS_SUSPENSION'
            });
            await expect(
                mirrorOurCancellationOnActive(
                    { subscriptionId: seeded.principalId, readAt: complementNow, everyMonths: 1 },
                    {
                        clock,
                        complements: {
                            ...seeded.policy,
                            addonPolicy: async () => {
                                throw new Error('policy read failed');
                            }
                        },
                        provider: harness.provider,
                        beforeCancelNotice: notice
                    }
                )
            ).rejects.toThrow('policy read failed');
            const [mainAfterRollback] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.principalId));
            expect(mainAfterRollback?.status).toBe('ACTIVE');
            const withoutRule = await mirrorOurCancellationOnActive(
                { subscriptionId: seeded.principalId, readAt: complementNow, everyMonths: 1 },
                { clock }
            );
            expect(withoutRule.outcome).toBe('SCHEDULED');
            const events = await domainEventModel.findByEntity({
                entityType: 'subscription',
                entityId: seeded.complementId
            });
            expect(
                events.filter(
                    (event) => event.eventType === 'subscription.provider_cancellation_decided'
                )
            ).toHaveLength(0);
        });
    }
);
