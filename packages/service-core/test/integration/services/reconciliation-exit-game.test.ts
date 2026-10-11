/** HOS-1610 completes the other nineteen clauses in this file. */
import { eq, providerLinks, subscriptions } from '@repo/db';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { handleUnknownAuthorization } from '../../../src/services/billing/reconciliation/handle-unknown-authorization.service.js';
import { runReconciliationSweep } from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import {
    createReconciliationFake,
    reconciliationClock,
    seedSubscription,
    withSeededReconciliationInventory
} from './reconciliation-sweep-fixtures.js';

afterAll(closeServiceTestPool);

async function unknown(
    fake: ReturnType<typeof createReconciliationFake>['fake'],
    reference: string
) {
    const authorization = await fake.authorize({
        reference,
        amount: { amountMinor: 250000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'exit game unknown',
        returnUrl: 'https://example.test',
        payerEmail: `exit-${crypto.randomUUID()}@example.test`
    });
    await fake.approve({ authorizationId: authorization.authorizationId });
    return authorization.authorizationId;
}

describe('TEST:B11:20 el juego de salida contra el falso', () => {
    it('LISTA:B11 cláusula 1: ningún barrido lista desde el buscador con M4 encendida', async () => {
        const { fake } = createReconciliationFake();
        const one = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        const two = await seedSubscription({
            status: 'ACTIVE',
            class: 'COMPLEMENTO',
            withLink: true,
            fake
        });
        const search = vi.spyOn(fake, 'searchAuthorizations');
        const summary = await withSeededReconciliationInventory(() =>
            runReconciliationSweep({}, { provider: fake, clock: reconciliationClock })
        );
        expect(summary.rowsRead).toBe(2);
        expect(search).not.toHaveBeenCalled();
        expect(one.providerId).toBeDefined();
        expect(two.providerId).toBeDefined();
    });

    it('LISTA:B11 cláusula 5: unknown references with a live link or no row are marked, never relinked', async () => {
        const { fake, provider } = createReconciliationFake();
        const linked = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        const duplicate = await unknown(fake, linked.subscription.id);
        const linkedResult = await handleUnknownAuthorization(
            {
                authorizationId: duplicate,
                arrival: { kind: 'AUTHORIZATION' },
                correlationId: crypto.randomUUID()
            },
            { provider, clock: reconciliationClock }
        );
        expect(linkedResult).toMatchObject({
            outcome: 'MARKED',
            reason: 'TRANSICION_NO_DECLARADA',
            subscriptionId: linked.subscription.id
        });
        const orphanId = await unknown(fake, 'not-an-owned-uuid');
        const orphanResult = await handleUnknownAuthorization(
            {
                authorizationId: orphanId,
                arrival: { kind: 'AUTHORIZATION' },
                correlationId: crypto.randomUUID()
            },
            { provider, clock: reconciliationClock }
        );
        expect(orphanResult).toMatchObject({
            outcome: 'MARKED',
            reason: 'TRANSICION_NO_DECLARADA',
            tombstone: true
        });
        expect(
            await getServiceTestDb()
                .select()
                .from(providerLinks)
                .where(eq(providerLinks.subscriptionId, linked.subscription.id))
        ).toHaveLength(1);
        const [orphan] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, orphanResult.subscriptionId));
        expect(orphan).toMatchObject({ class: 'LAPIDA', status: 'CANCELLED' });
    });
});
