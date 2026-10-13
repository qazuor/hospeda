/**
 * LISTA:B11 against the fake. Here: clauses 1, 5, 9 (second half), 11 and 15
 * (HOS-1602, HOS-1603). The other sixteen (2–4, 6–8, the first half of 9, 10,
 * 12–14 and 16–21) are completed by B11.10 (HOS-1610) and the sibling leaves.
 */
import { eq, providerLinks, RECONCILIATION_MARK_REASON_CATALOG, subscriptions } from '@repo/db';
import { parseProbeManifest } from '@repo/payments';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { handleUnknownAuthorization } from '../../../src/services/billing/reconciliation/handle-unknown-authorization.service.js';
import { runReconciliationSweep } from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import {
    createReconciliationFake,
    reconciliationClock,
    seedSubscription,
    withSeededReconciliationInventory
} from './reconciliation-sweep-fixtures.js';
import {
    createChargingFake,
    handleCharge,
    settlementRows,
    tombstoneRows,
    unknownCharge as unknownDebit
} from './reconciliation-tombstone-fixtures.js';

beforeAll(() => {
    getServiceTestDb();
});
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

    it('LISTA:B11 cláusula 9 (segunda mitad): un cobro de una sonda del manifiesto escribe su lápida de recepción sin mandar cancelar el preapproval', async () => {
        const { fake, provider } = createChargingFake();
        const { authorizationId, chargeId } = await unknownDebit(fake);
        const { manifest } = parseProbeManifest({ input: { ids: [authorizationId] } });
        const cancel = vi.spyOn(fake, 'cancel');
        const { result } = await handleCharge(
            { authorizationId, chargeId },
            { provider, probeManifest: manifest }
        );
        expect(result).toMatchObject({ tombstone: true, cancellation: 'PROBE_SKIPPED' });
        const rows = await tombstoneRows(result.subscriptionId);
        expect(rows.subscription).toMatchObject({ class: 'LAPIDA', status: 'CANCELLED' });
        expect(rows.marks.map((mark) => mark.reason)).toEqual(['PAGO_TARDIO_RECHAZADO']);
        expect(cancel).not.toHaveBeenCalled();
    });

    it('LISTA:B11 cláusula 11: un cobro sobre una lápida deja un payment SUCCEEDED con su comprobante, sin covered_period y sin aviso de cobertura, y con el consumidor del aviso caído quedan escritos', async () => {
        const { fake, provider } = createChargingFake();
        const { authorizationId, chargeId } = await unknownDebit(fake);
        const emitCoverageChanged = vi.fn(async () => {
            throw new Error('coverage consumer down');
        });
        const { result } = await handleCharge(
            { authorizationId, chargeId },
            { provider, coverageNotices: { emitCoverageChanged } }
        );
        if (result.outcome !== 'MARKED' || !result.paymentId)
            throw new Error('Expected a tombstone');
        const rows = await tombstoneRows(result.subscriptionId);
        expect(rows.payments).toMatchObject([{ id: result.paymentId, status: 'SUCCEEDED' }]);
        expect(rows.marks.map((mark) => mark.reason)).toEqual(['PAGO_TARDIO_RECHAZADO']);
        const settled = await settlementRows({
            paymentId: result.paymentId,
            subscriptionId: result.subscriptionId
        });
        expect(settled.receipts).toHaveLength(1);
        expect(settled.mails).toHaveLength(0);
        expect(settled.coverageBySubscription).toHaveLength(0);
        expect(emitCoverageChanged).not.toHaveBeenCalled();
    });

    it('LISTA:B11 cláusula 15: un cobro aprobado sobre un preapproval cancelado del sistema viejo escribe su lápida, cuelga el payment y abre PAGO_TARDÍO_RECHAZADO con la propuesta de devolverlo', async () => {
        const { fake, provider } = createChargingFake();
        const { authorizationId, chargeId } = await unknownDebit(fake, {
            cancelledAfterCharge: true
        });
        const { result } = await handleCharge({ authorizationId, chargeId }, { provider });
        expect(result).toMatchObject({
            reason: 'PAGO_TARDIO_RECHAZADO',
            tombstone: true,
            cancellation: 'ALREADY_CANCELLED'
        });
        if (result.outcome !== 'MARKED' || !result.paymentId)
            throw new Error('Expected a tombstone');
        const rows = await tombstoneRows(result.subscriptionId);
        expect(rows.subscription).toMatchObject({ class: 'LAPIDA', status: 'CANCELLED' });
        expect(rows.hung.map((hung) => hung.paymentId)).toEqual([result.paymentId]);
        expect(rows.marks).toMatchObject([{ reason: 'PAGO_TARDIO_RECHAZADO', liftedAt: null }]);
        expect(RECONCILIATION_MARK_REASON_CATALOG.PAGO_TARDIO_RECHAZADO.defaultProposal).toBe(
            'REFUND'
        );
    });
});
