import {
    and,
    emailOutbox,
    eq,
    isNull,
    reconciliationMarks,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import type { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    complementNow,
    retireComplementRows,
    seedCommittedComplement
} from './support/complement-fixtures.js';
import { graceWithFailedCycle } from './support/grace-fixtures.js';

const fixtures: { subscriptionId: string; userId: string }[] = [];
afterEach(async () => {
    await retireComplementRows();
    for (const row of fixtures.splice(0)) {
        await getServiceTestDb()
            .update(reconciliationMarks)
            .set({ liftedAt: complementNow, liftedBy: row.userId })
            .where(
                and(
                    eq(reconciliationMarks.subscriptionId, row.subscriptionId),
                    isNull(reconciliationMarks.liftedAt)
                )
            );
        await getServiceTestDb()
            .delete(subscriptionPauses)
            .where(eq(subscriptionPauses.subscriptionId, row.subscriptionId));
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null })
            .where(eq(subscriptions.id, row.subscriptionId));
        await getServiceTestDb()
            .delete(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, row.userId));
    }
});
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-1562 TEST:B7:14 AC:B7:23 AC:B7:21 S7 reanuda los complementos pausados',
    () => {
        it('reactiva la principal y el complemento, y cierra la pausa tras el commit de S7', async () => {
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
                scopeType: 'USER',
                otherStatus: 'ACTIVE',
                complementStatus: 'PAUSED',
                openPause: true
            });
            if (!seeded.authorizationId) throw new Error('complement authorization missing');
            await (fixture.provider as unknown as FakePaymentProvider).pause({
                authorizationId: seeded.authorizationId
            });
            fixture.advanceToAttempt(3);
            const result = await recordChargeFact(
                { chargeId: fixture.chargeId },
                { ...fixture.ports, complements: seeded.policy }
            );
            expect(result).toMatchObject({
                outcome: 'CREDITED',
                reactivation: {
                    outcome: 'REACTIVATED',
                    destination: 'ACTIVE',
                    complements: {
                        results: [
                            {
                                outcome: 'REACTIVATED',
                                complementSubscriptionId: seeded.complementId
                            }
                        ]
                    }
                }
            });
            const [main] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            const [complement] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.complementId));
            const [pause] = await getServiceTestDb()
                .select()
                .from(subscriptionPauses)
                .where(eq(subscriptionPauses.subscriptionId, seeded.complementId));
            expect(main?.status).toBe('ACTIVE');
            expect(complement?.status).toBe('ACTIVE');
            expect(pause?.actualEndAt).toBeTruthy();
        });

        it('si S7 decide CANCEL_SCHEDULED no ejecuta S33', async () => {
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
                complementStatus: 'PAUSED',
                openPause: true
            });
            await (fixture.provider as unknown as FakePaymentProvider).cancel({
                authorizationId: fixture.started.authorizationId
            });
            fixture.advanceToAttempt(3);
            const result = await recordChargeFact(
                { chargeId: fixture.chargeId },
                { ...fixture.ports, complements: seeded.policy }
            );
            expect(result).toMatchObject({
                outcome: 'CREDITED',
                reactivation: { outcome: 'REACTIVATED', destination: 'CANCEL_SCHEDULED' }
            });
            const [complement] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.complementId));
            expect(complement?.status).toBe('PAUSED');
        });

        it('sin puerto S33 conserva la fila PAUSED al reactivar la principal', async () => {
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
                complementStatus: 'PAUSED',
                openPause: true
            });
            fixture.advanceToAttempt(3);
            const result = await recordChargeFact({ chargeId: fixture.chargeId }, fixture.ports);
            expect(result).toMatchObject({
                outcome: 'CREDITED',
                reactivation: { outcome: 'REACTIVATED', destination: 'ACTIVE' }
            });
            const [complement] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.complementId));
            expect(complement?.status).toBe('PAUSED');
        });
    }
);
