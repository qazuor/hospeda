import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { RECONCILIATION_MARK_REASON_CATALOG } from '@repo/db';
import { parseProbeManifest } from '@repo/payments';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import {
    createChargingFake,
    handleCharge,
    markOpenedEvents,
    tombstoneRows,
    unknownCharge
} from './reconciliation-tombstone-fixtures.js';

const HANDLER = join(
    resolve(import.meta.dirname, '../../..'),
    'src/services/billing/reconciliation/handle-unknown-authorization.service.ts'
);

beforeAll(() => {
    getServiceTestDb();
});
afterAll(closeServiceTestPool);
beforeEach(() => vi.restoreAllMocks());

/** Drops line and block comments, so a commented-out import does not count. */
function withoutComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

describe('TEST:B11:4 las sondas no se cancelan', () => {
    it('TEST:B11:4 a charge of a manifest probe writes its tombstone, payment and reason 7, and is never cancelled', async () => {
        const { fake, provider } = createChargingFake();
        const { authorizationId, chargeId } = await unknownCharge(fake);
        const { manifest } = parseProbeManifest({ input: { ids: [authorizationId] } });
        const cancel = vi.spyOn(fake, 'cancel');
        const { result, correlationId } = await handleCharge(
            { authorizationId, chargeId },
            { provider, probeManifest: manifest }
        );
        expect(result).toMatchObject({
            outcome: 'MARKED',
            reason: 'PAGO_TARDIO_RECHAZADO',
            tombstone: true,
            cancellation: 'PROBE_SKIPPED'
        });
        if (result.outcome !== 'MARKED') throw new Error('Expected a tombstone');
        const rows = await tombstoneRows(result.subscriptionId);
        expect(rows.subscription).toMatchObject({ class: 'LAPIDA', status: 'CANCELLED' });
        expect(rows.links.map((link) => link.providerId)).toEqual([authorizationId]);
        expect(rows.payments.map((payment) => payment.id)).toEqual([result.paymentId]);
        expect(rows.marks.map((mark) => mark.reason)).toEqual(['PAGO_TARDIO_RECHAZADO']);
        expect(rows.hung.map((hung) => hung.paymentId)).toEqual([result.paymentId]);
        expect(await markOpenedEvents(correlationId)).toHaveLength(1);
        expect(RECONCILIATION_MARK_REASON_CATALOG.PAGO_TARDIO_RECHAZADO.defaultProposal).toBe(
            'REFUND'
        );
        expect(cancel).not.toHaveBeenCalled();
        expect((await fake.readAuthorization({ authorizationId })).snapshot.status).toBe('active');
    });

    it('TEST:B11:4 an unknown authorization outside the manifest is cancelled', async () => {
        const { fake, provider } = createChargingFake();
        const probe = await unknownCharge(fake);
        const { authorizationId, chargeId } = await unknownCharge(fake);
        const { manifest } = parseProbeManifest({ input: { ids: [probe.authorizationId] } });
        const cancel = vi.spyOn(fake, 'cancel');
        const { result } = await handleCharge(
            { authorizationId, chargeId },
            { provider, probeManifest: manifest }
        );
        expect(result).toMatchObject({ tombstone: true, cancellation: 'CONFIRMED' });
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(cancel).toHaveBeenCalledWith({ authorizationId });
    });

    it('TEST:B11:4 the handler imports the probe manifest as a module from @repo/payments: without it the build does not compile', () => {
        const source = withoutComments(readFileSync(HANDLER, 'utf8'));
        const fromPayments = [
            ...source.matchAll(/import\s*\{([^}]*)\}\s*from\s*'@repo\/payments'/g)
        ]
            .map((match) => match[1] ?? '')
            .join(',');
        expect(fromPayments).toMatch(/(^|[\s,])isProbeSubject([\s,]|$)/);
        expect(fromPayments).toMatch(/(^|[\s,])PROBE_MANIFEST([\s,]|$)/);
        expect(source).toMatch(
            /isProbeSubject\(\{[\s\S]*?ports\.probeManifest \?\? PROBE_MANIFEST/
        );
    });
});
