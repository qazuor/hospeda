/**
 * LISTA:B11 against the fake. This file: clauses 1, 5, 9 (second half), 11, 15 and 16 (HOS-1602, HOS-1603, HOS-1676). The rest live in the sibling `reconciliation-exit-game-*.test.ts` files (HOS-1611, B11.10); clauses 8, 17 and 18 are phase 2 (AC:B11:14, HOS-1636).
 */
import {
    eq,
    providerLinks,
    RECONCILIATION_MARK_REASON_CATALOG,
    reconciliationInventoryModel,
    subscriptions
} from '@repo/db';
import { parseProbeManifest } from '@repo/payments';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { handleUnknownAuthorization } from '../../../src/services/billing/reconciliation/handle-unknown-authorization.service.js';
import {
    CANCEL_SCHEDULED_TRANSITIONS,
    SALVEDAD_1_TRANSITIONS,
    SALVEDAD_4_TRANSITIONS
} from '../../../src/services/billing/reconciliation/provider-cancellation-decision.js';
import { runReconciliationSweep } from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import {
    createReconciliationFake,
    reconciliationClock,
    seedSubscription,
    trackSeededReconciliationRow,
    withSeededCancellationRetryInventory,
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

    it('LISTA:B11 cláusula 16: la salvedad 4 del barrido cuenta las catorce transiciones (TEST:1732:12 AC:1732:9)', async () => {
        // B11.md:372: S12, S3, S13, S16, S20, S22, S23, S24, S31, S36 and the receipt tombstone;
        // the twelfth is the inherited Tourist VIP, by the owner's decision H3 → b (Coord-289);
        // the thirteenth is REJECTION_REVIVED, the revived rejection terminal (Coord-351 F3, B11 §3);
        // the fourteenth is S39, the replaced pending attempt (HOS-1732).
        const spec = ['S12', 'S3', 'S13', 'S16', 'S20', 'S22', 'S23', 'S24', 'S31', 'S36'];
        expect(SALVEDAD_4_TRANSITIONS).toHaveLength(14);
        expect([...SALVEDAD_4_TRANSITIONS].sort()).toEqual(
            [
                ...spec,
                'RECEPTION_TOMBSTONE',
                'TOURIST_VIP_INHERITED',
                'REJECTION_REVIVED',
                'S39'
            ].sort()
        );
        expect(SALVEDAD_4_TRANSITIONS.filter((code) => code.endsWith('_TOMBSTONE'))).toEqual([
            'RECEPTION_TOMBSTONE'
        ]);
        expect([...SALVEDAD_1_TRANSITIONS]).toContain('S21');
        expect([...SALVEDAD_4_TRANSITIONS]).not.toContain('S21');
        expect([...CANCEL_SCHEDULED_TRANSITIONS]).toEqual(['S11']);

        // A receipt tombstone with its decision enters the retry pass.
        const { fake, provider } = createChargingFake();
        const { authorizationId, chargeId } = await unknownDebit(fake);
        const { result } = await handleCharge({ authorizationId, chargeId }, { provider });
        if (result.outcome !== 'MARKED') throw new Error('Expected a tombstone');
        trackSeededReconciliationRow(result.subscriptionId);
        const page = await withSeededCancellationRetryInventory(() =>
            reconciliationInventoryModel.listCancellationRetryPage({ limit: 10 })
        );
        expect(
            page.map((row) => [
                row.subscription.id,
                row.subscription.class,
                row.decision.transition
            ])
        ).toEqual([[result.subscriptionId, 'LAPIDA', 'RECEPTION_TOMBSTONE']]);
    });
});
