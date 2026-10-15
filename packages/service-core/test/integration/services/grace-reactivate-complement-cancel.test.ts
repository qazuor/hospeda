import { and, domainEventModel, eq, isNull, reconciliationMarks, subscriptions } from '@repo/db';
import type { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    complementNow,
    retireComplementRows,
    seedCommittedComplement
} from './support/complement-fixtures.js';
import { graceWithFailedCycle } from './support/grace-fixtures.js';

const fixtures: { readonly subscriptionId: string; readonly userId: string }[] = [];
afterEach(async () => {
    await retireComplementRows();
    for (const item of fixtures.splice(0)) {
        await getServiceTestDb()
            .update(reconciliationMarks)
            .set({ liftedAt: complementNow, liftedBy: item.userId })
            .where(
                and(
                    eq(reconciliationMarks.subscriptionId, item.subscriptionId),
                    isNull(reconciliationMarks.liftedAt)
                )
            );
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null })
            .where(eq(subscriptions.id, item.subscriptionId));
    }
});
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-1562 TEST:B7:8 AC:B7:14 S7 a CANCEL_SCHEDULED cancela los complementos',
    () => {
        it('cancela el complemento ACTIVE no pausado por S32, preserva la marca 22 y el proveedor', async () => {
            const fixture = await graceWithFailedCycle({ approveOnAttempt: 3 });
            fixtures.push({
                subscriptionId: fixture.started.subscriptionId,
                userId: fixture.user.id
            });
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'SUSPENDED' })
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            const seeded = await seedCommittedComplement({
                fake: fixture.provider as unknown as FakePaymentProvider,
                principalStatus: 'SUSPENDED',
                principal: { userId: fixture.user.id, principalId: fixture.started.subscriptionId },
                scopeType: 'VERTICAL_SUBSCRIPTION',
                complementStatus: 'ACTIVE'
            });
            if (!seeded.authorizationId) throw new Error('complement authorization missing');
            await getServiceTestDb().transaction(async (tx) =>
                openReconciliationMark({
                    subject: { kind: 'SUBSCRIPTION', subscriptionId: seeded.complementId },
                    reason: 'PAUSA_NO_APLICADA',
                    actor: { type: 'job' },
                    correlationId: crypto.randomUUID(),
                    tx
                })
            );
            await (fixture.provider as unknown as FakePaymentProvider).cancel({
                authorizationId: fixture.started.authorizationId
            });
            fixture.advanceToAttempt(3);
            const principalNotice = fixture.ports.beforeCancelNotice;
            if (!principalNotice) throw new Error('fixture before-cancel notice missing');
            let principalStatusDuringComplementNotice: string | undefined;
            const result = await recordChargeFact(
                { chargeId: fixture.chargeId },
                {
                    ...fixture.ports,
                    complements: seeded.policy,
                    beforeCancelNotice: {
                        beforeCancel: async (args) => {
                            const [principal] = await getServiceTestDb()
                                .select({ status: subscriptions.status })
                                .from(subscriptions)
                                .where(eq(subscriptions.id, fixture.started.subscriptionId));
                            principalStatusDuringComplementNotice = principal?.status;
                            return principalNotice.beforeCancel(args);
                        }
                    }
                }
            );
            expect(result).toMatchObject({
                outcome: 'CREDITED',
                reactivation: { outcome: 'REACTIVATED', destination: 'CANCEL_SCHEDULED' }
            });
            const [main] = await getServiceTestDb()
                .select({ status: subscriptions.status, end: subscriptions.serviceEndsAt })
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            const [complement] = await getServiceTestDb()
                .select({ status: subscriptions.status, end: subscriptions.serviceEndsAt })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.complementId));
            expect(main?.status).toBe('CANCEL_SCHEDULED');
            expect(principalStatusDuringComplementNotice).toBe('CANCEL_SCHEDULED');
            expect(complement).toEqual({ status: 'CANCEL_SCHEDULED', end: main?.end });
            expect(
                (
                    await (fixture.provider as unknown as FakePaymentProvider).readAuthorization({
                        authorizationId: seeded.authorizationId
                    })
                ).snapshot.status
            ).toBe('cancelled');
            const events = await domainEventModel.findByEntity({
                entityType: 'subscription',
                entityId: seeded.complementId
            });
            expect(
                events
                    .filter(
                        (event) => event.eventType === 'subscription.provider_cancellation_decided'
                    )
                    .map((event) => event.reason)
            ).toContain('S11');
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

        it('sin el puerto complementario mantiene el comportamiento de S7', async () => {
            const fixture = await graceWithFailedCycle({ approveOnAttempt: 3 });
            fixtures.push({
                subscriptionId: fixture.started.subscriptionId,
                userId: fixture.user.id
            });
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'SUSPENDED' })
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            await (fixture.provider as unknown as FakePaymentProvider).cancel({
                authorizationId: fixture.started.authorizationId
            });
            fixture.advanceToAttempt(3);
            const result = await recordChargeFact({ chargeId: fixture.chargeId }, fixture.ports);
            expect(result).toMatchObject({
                outcome: 'CREDITED',
                reactivation: { outcome: 'REACTIVATED', destination: 'CANCEL_SCHEDULED' }
            });
        });
    }
);
