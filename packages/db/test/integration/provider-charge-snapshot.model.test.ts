import { afterAll, describe, expect, it } from 'vitest';
import { providerChargeSnapshotModel as model } from '../../src/models/provider-charge-snapshot/provider-charge-snapshot.model.ts';
import type { InsertProviderChargeSnapshot } from '../../src/schemas/vertical/provider-charge-snapshot.dbschema.ts';
import { closeTestPool, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);

const PROVIDER = 'MERCADO_PAGO';

function snapshotRow(overrides: Partial<InsertProviderChargeSnapshot> = {}) {
    return {
        provider: PROVIDER,
        chargeId: `charge-${crypto.randomUUID()}`,
        authorizationId: 'auth-1',
        providerCreatedAt: new Date('2026-01-01T00:00:00.000Z'),
        expiresAt: null,
        status: 'approved',
        purpose: 'charge',
        reference: 'ref-1',
        declineReason: null,
        amountMinor: 100_000,
        refundedAmountMinor: 0,
        currency: 'ARS',
        chargedBack: false,
        observedAt: new Date('2026-02-01T00:00:00.000Z'),
        ...overrides
    } satisfies InsertProviderChargeSnapshot;
}

describe('provider charge snapshot model (HOS-1999 B3)', () => {
    it('keeps the newer observation when an older read finishes later (AC-11)', async () => {
        await withTestTransaction(async (tx) => {
            const newer = snapshotRow({ observedAt: new Date('2026-02-02T00:00:00.000Z') });
            const older = {
                ...newer,
                status: 'pending',
                observedAt: new Date('2026-02-01T00:00:00.000Z')
            };
            expect(await model.upsertOrdered({ row: newer, tx })).toEqual({ written: true });
            expect(await model.upsertOrdered({ row: older, tx })).toEqual({ written: false });
            const [stored] = await model.findByChargeIds({
                provider: PROVIDER,
                chargeIds: [newer.chargeId],
                tx
            });
            expect(stored?.status).toBe('approved');
            expect(stored?.observedAt.toISOString()).toBe('2026-02-02T00:00:00.000Z');
        });
    });

    it('never loses a refund or a chargeback to an out-of-order read, and an older read that saw more raises them', async () => {
        await withTestTransaction(async (tx) => {
            const refunded = snapshotRow({
                refundedAmountMinor: 60_000,
                chargedBack: true,
                observedAt: new Date('2026-02-02T00:00:00.000Z')
            });
            await model.upsertOrdered({ row: refunded, tx });
            const stale = {
                ...refunded,
                status: 'pending',
                refundedAmountMinor: 0,
                chargedBack: false,
                observedAt: new Date('2026-02-03T00:00:00.000Z')
            };
            // A later-finishing read carrying older provider state: its status wins by order,
            // but the grow-only fields cannot shrink.
            expect(await model.upsertOrdered({ row: stale, tx })).toEqual({ written: true });
            const olderButMore = {
                ...refunded,
                refundedAmountMinor: 90_000,
                observedAt: new Date('2026-02-01T00:00:00.000Z')
            };
            expect(await model.upsertOrdered({ row: olderButMore, tx })).toEqual({ written: true });
            const [stored] = await model.findByChargeIds({
                provider: PROVIDER,
                chargeIds: [refunded.chargeId],
                tx
            });
            expect(stored).toMatchObject({
                status: 'pending',
                refundedAmountMinor: 90_000,
                chargedBack: true
            });
            expect(stored?.observedAt.toISOString()).toBe('2026-02-03T00:00:00.000Z');
        });
    });

    it('overwrites with an equal or newer observation and rewrites a closed approved row on refund (AC-12)', async () => {
        await withTestTransaction(async (tx) => {
            const first = snapshotRow();
            await model.upsertOrdered({ row: first, tx });
            const refunded = {
                ...first,
                refundedAmountMinor: 100_000,
                observedAt: new Date('2026-03-01T00:00:00.000Z')
            };
            expect(await model.upsertOrdered({ row: refunded, tx })).toEqual({ written: true });
            const sameInstant = { ...refunded, chargedBack: true };
            expect(await model.upsertOrdered({ row: sameInstant, tx })).toEqual({ written: true });
            const [stored] = await model.findByChargeIds({
                provider: PROVIDER,
                chargeIds: [first.chargeId],
                tx
            });
            expect(stored).toMatchObject({ refundedAmountMinor: 100_000, chargedBack: true });
        });
    });

    it('finds only the requested ids of one provider and skips the query for none', async () => {
        await withTestTransaction(async (tx) => {
            const wanted = snapshotRow();
            const other = snapshotRow();
            const foreign = snapshotRow({ provider: 'OTHER', chargeId: wanted.chargeId });
            await model.upsertOrdered({ row: wanted, tx });
            await model.upsertOrdered({ row: other, tx });
            await model.upsertOrdered({ row: foreign, tx });
            const found = await model.findByChargeIds({
                provider: PROVIDER,
                chargeIds: [wanted.chargeId],
                tx
            });
            expect(found.map((row) => [row.provider, row.chargeId])).toEqual([
                [PROVIDER, wanted.chargeId]
            ]);
            expect(await model.findByChargeIds({ provider: PROVIDER, chargeIds: [], tx })).toEqual(
                []
            );
        });
    });
});
