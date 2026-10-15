import { emailOutbox, eq, subscriptions } from '@repo/db';
import type { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { suspendForArrears } from '../../../src/services/billing/subscription/suspend-for-arrears.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { retireComplementRows, seedCommittedComplement } from './support/complement-fixtures.js';
import { graceWithFailedCycle } from './support/grace-fixtures.js';

const principalRows: { readonly id: string; readonly userId: string }[] = [];
afterEach(async () => {
    await retireComplementRows();
    const rows = principalRows.splice(0);
    if (!rows.length) return;
    const row = rows[0];
    if (!row) return;
    await getServiceTestDb()
        .update(subscriptions)
        .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null })
        .where(eq(subscriptions.id, row.id));
    await getServiceTestDb().delete(emailOutbox).where(eq(emailOutbox.recipientUserId, row.userId));
});
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-1562 TEST:B7:14 AC:B7:22 S6 pausa complementos después de suspender',
    () => {
        it('deja la principal SUSPENDED, pausa el complemento y devuelve el resumen S32', async () => {
            const fixture = await graceWithFailedCycle();
            principalRows.push({ id: fixture.started.subscriptionId, userId: fixture.user.id });
            const [principal] = await getServiceTestDb()
                .select({ graceEndsAt: subscriptions.graceEndsAt })
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            if (!principal?.graceEndsAt) throw new Error('grace clock missing');
            fixture.clock.advance({
                ms: principal.graceEndsAt.getTime() + 60_000 - fixture.clock.now().getTime()
            });
            const seeded = await seedCommittedComplement({
                fake: fixture.provider as unknown as FakePaymentProvider,
                principalStatus: 'GRACE_PERIOD',
                principal: { userId: fixture.user.id, principalId: fixture.started.subscriptionId },
                scopeType: 'VERTICAL_SUBSCRIPTION'
            });
            const result = await suspendForArrears(
                {
                    subscriptionId: fixture.started.subscriptionId,
                    event: 'GRACE_EXPIRED',
                    occurrenceId: `S32-${crypto.randomUUID()}`
                },
                { ...fixture.ports, complements: seeded.policy }
            );
            expect(result).toMatchObject({
                outcome: 'SUSPENDED',
                complements: {
                    results: [{ outcome: 'PAUSED', complementSubscriptionId: seeded.complementId }]
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
            expect(main?.status).toBe('SUSPENDED');
            expect(complement?.status).toBe('PAUSED');
            if (!seeded.authorizationId) throw new Error('provider authorization was not seeded');
            expect(
                await fixture.provider
                    .readAuthorization({ authorizationId: seeded.authorizationId })
                    .then(({ snapshot }) => snapshot.status)
            ).toBe('paused');
        });

        it('sin el puerto conserva la forma del resultado actual y no toca complementos', async () => {
            const fixture = await graceWithFailedCycle();
            principalRows.push({ id: fixture.started.subscriptionId, userId: fixture.user.id });
            const [principal] = await getServiceTestDb()
                .select({ graceEndsAt: subscriptions.graceEndsAt })
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            if (!principal?.graceEndsAt) throw new Error('grace clock missing');
            fixture.clock.advance({
                ms: principal.graceEndsAt.getTime() + 60_000 - fixture.clock.now().getTime()
            });
            const seeded = await seedCommittedComplement({
                fake: fixture.provider as unknown as FakePaymentProvider,
                principalStatus: 'GRACE_PERIOD',
                principal: { userId: fixture.user.id, principalId: fixture.started.subscriptionId },
                scopeType: 'VERTICAL_SUBSCRIPTION'
            });
            const result = await suspendForArrears(
                {
                    subscriptionId: fixture.started.subscriptionId,
                    event: 'GRACE_EXPIRED',
                    occurrenceId: `S32-${crypto.randomUUID()}`
                },
                fixture.ports
            );
            expect(result).toEqual({
                outcome: 'SUSPENDED',
                subscriptionId: fixture.started.subscriptionId,
                cancelCall: 'SENT'
            });
            const [complement] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.complementId));
            expect(complement?.status).toBe('ACTIVE');
        });
    }
);
