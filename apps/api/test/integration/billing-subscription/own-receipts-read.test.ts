/**
 * Who owns a receipt (HOS-2566), against the real tables: a receipt carries no
 * owner column, so ownership is resolved through the payment, manual payment
 * or add-on instance it was issued for. A stranger's read is the same `null` as a missing id.
 */

import { coveredPeriods, eq, getDb, inArray, payments, receipts } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { readReceiptDetails } from '../../../src/services/payment-receipt/receipt-details-read';
import {
    listOwnReceipts,
    readOwnReceipt
} from '../../../src/services/payment-receipt/receipt-read';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    CHARGED_AT,
    NOW,
    retireRevocationRouteRows,
    routeClock,
    routeFake,
    seedManualPayment,
    seedOneTimeOrphan,
    seedPrincipal,
    seedRevocable,
    seedUser
} from './revocation-route-fixtures';

const clock = routeClock(NOW);
const fake = routeFake(clock);
const issued: string[] = [];
const periods: string[] = [];
let app: ReturnType<typeof initApp>;

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    app = initApp({ clock, paymentProvider: fake });
});
afterEach(async () => {
    // Covered periods reference the payments the shared retire helper deletes.
    if (periods.length > 0) {
        await getDb()
            .delete(coveredPeriods)
            .where(inArray(coveredPeriods.id, periods.splice(0)));
    }
    // Receipts reference the payments the shared retire helper deletes.
    if (issued.length > 0) {
        await getDb()
            .delete(receipts)
            .where(inArray(receipts.id, issued.splice(0)));
    }
    await retireRevocationRouteRows();
});
afterAll(async () => {
    await testDb.teardown();
});

async function issue(input: { paymentId?: string; manualPaymentId?: string }): Promise<string> {
    const [row] = await getDb()
        .insert(receipts)
        .values({
            paymentId: input.paymentId ?? null,
            manualPaymentId: input.manualPaymentId ?? null,
            // `receipt_number` is unique across the table: stay clear of real numbering.
            receiptNumber: 900_000_000 + Math.floor(Math.random() * 99_000_000),
            payerName: 'Owner',
            payerEmail: 'owner@example.test'
        })
        .returning({ id: receipts.id });
    if (!row) throw new Error('Expected receipt');
    issued.push(row.id);
    return row.id;
}

describe('receipt ownership (HOS-2566)', () => {
    it('reads the receipt of an automatic payment for its owner only', async () => {
        const { ownerId, paymentId } = await seedRevocable();
        const receiptId = await issue({ paymentId });
        const stranger = await seedUser('stranger');

        const own = await readOwnReceipt({ receiptId, userId: ownerId });
        const foreign = await readOwnReceipt({ receiptId, userId: stranger });

        expect(own?.id).toBe(receiptId);
        expect(own?.amountMinor).toEqual(expect.any(Number));
        expect(own?.concept.kind).toBe('PLAN');
        expect(foreign).toBeNull();
    });

    it('reads the receipt of a manual payment for its owner only, with no amount', async () => {
        const ownerId = await seedUser('manual-owner');
        const subscriptionId = await seedPrincipal({ ownerId, paymentMethod: 'MANUAL' });
        const manualPaymentId = await seedManualPayment({ subscriptionId, registeredBy: ownerId });
        const receiptId = await issue({ manualPaymentId });
        const stranger = await seedUser('stranger');

        const own = await readOwnReceipt({ receiptId, userId: ownerId });

        expect(own?.amountMinor).toBeNull();
        expect(await readOwnReceipt({ receiptId, userId: stranger })).toBeNull();
    });

    it('reads the receipt of an add-on payment through the instance owner, never another account', async () => {
        const ownerId = await seedUser('addon-owner');
        const principalId = await seedPrincipal({ ownerId });
        const { paymentId } = await seedOneTimeOrphan({ ownerId, principalId });
        const receiptId = await issue({ paymentId });
        const stranger = await seedUser('stranger');

        const own = await readOwnReceipt({ receiptId, userId: ownerId });

        expect(own?.concept.kind).toBe('ADDON');
        expect(own?.amountMinor).toBe(5000);
        expect(await readOwnReceipt({ receiptId, userId: stranger })).toBeNull();
    });

    it("lists only the caller's receipts", async () => {
        const first = await seedRevocable();
        const second = await seedRevocable();
        await issue({ paymentId: first.paymentId });
        await issue({ paymentId: second.paymentId });

        const mine = await listOwnReceipts({ userId: first.ownerId });

        expect(mine).toHaveLength(1);
        expect(await listOwnReceipts({ userId: await seedUser('nobody') })).toHaveLength(0);
    });

    it('serves the PDF over the real route to the owner and 404s the stranger', async () => {
        const { ownerId, paymentId } = await seedRevocable();
        const receiptId = await issue({ paymentId });
        const stranger = await seedUser('stranger');
        const path = `/api/v1/protected/billing-subscription/receipts/${receiptId}/pdf`;
        const as = (id: string) =>
            app.request(path, {
                headers: actorHeaders({
                    id,
                    role: 'USER',
                    permissions: [PermissionEnum.BILLING_VIEW_OWN]
                })
            });

        const own = await as(ownerId);

        expect(own.status).toBe(200);
        expect(own.headers.get('Content-Type')).toBe('application/pdf');
        const bytes = new Uint8Array(await own.arrayBuffer());
        expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
        expect((await as(stranger)).status).toBe(404);
    });
});

describe('receipt details for the document (HOS-2682)', () => {
    it('reads the account, plan, cycle, price and payment of an automatic payment', async () => {
        const { ownerId, paymentId } = await seedRevocable();
        const receipt = await readOwnReceipt({
            receiptId: await issue({ paymentId }),
            userId: ownerId
        });
        if (!receipt) throw new Error('Expected own receipt');

        const details = await readReceiptDetails({ receipt });

        expect(details).toMatchObject({
            accountName: 'B5.5 owner',
            vertical: 'accommodation',
            productName: 'B5.5 route',
            cycle: 'monthly',
            method: 'OTHER',
            paidAt: CHARGED_AT,
            promoCodes: [],
            planTrusted: true
        });
        expect(details.accountEmail).toMatch(/@example\.test$/);
    });

    it('reads a manual payment as manual, with its own id as reference and its period', async () => {
        const ownerId = await seedUser('manual-details');
        const subscriptionId = await seedPrincipal({ ownerId, paymentMethod: 'MANUAL' });
        const manualPaymentId = await seedManualPayment({ subscriptionId, registeredBy: ownerId });
        const receipt = await readOwnReceipt({
            receiptId: await issue({ manualPaymentId }),
            userId: ownerId
        });
        if (!receipt) throw new Error('Expected own receipt');

        const details = await readReceiptDetails({ receipt });

        expect(details.method).toBe('MANUAL');
        expect(details.operationId).toBe(manualPaymentId);
        expect(details.paidAt).toEqual(CHARGED_AT);
        expect(details.periodStart).toEqual(new Date('2026-10-01T03:00:00.000Z'));
        expect(details.periodEnd).toEqual(new Date('2026-11-01T03:00:00.000Z'));
    });

    it('reads an add-on payment through its product, with no plan vertical', async () => {
        const ownerId = await seedUser('addon-details');
        const principalId = await seedPrincipal({ ownerId });
        const { paymentId } = await seedOneTimeOrphan({ ownerId, principalId });
        const receipt = await readOwnReceipt({
            receiptId: await issue({ paymentId }),
            userId: ownerId
        });
        if (!receipt) throw new Error('Expected own receipt');

        const details = await readReceiptDetails({ receipt });

        expect(details).toMatchObject({
            accountName: 'B5.5 addon-details',
            vertical: null,
            productName: 'B5.6 route',
            cycle: null
        });
    });

    it('names a Mercado Pago payment as stored, and prints its open period over a released one', async () => {
        const { ownerId, subscriptionId, paymentId } = await seedRevocable();
        await getDb()
            .update(payments)
            .set({ provider: 'MERCADO_PAGO' })
            .where(eq(payments.id, paymentId));
        const rows = await getDb()
            .insert(coveredPeriods)
            .values([
                {
                    subscriptionId,
                    paymentId,
                    periodStart: new Date('2026-09-01T03:00:00.000Z'),
                    creditedAt: new Date('2026-09-01T03:00:00.000Z'),
                    releasedAt: new Date('2026-09-02T03:00:00.000Z')
                },
                {
                    subscriptionId,
                    paymentId,
                    periodStart: new Date('2026-10-01T03:00:00.000Z'),
                    creditedAt: new Date('2026-08-01T03:00:00.000Z')
                }
            ])
            .returning({ id: coveredPeriods.id });
        periods.push(...rows.map((row) => row.id));
        const receipt = await readOwnReceipt({
            receiptId: await issue({ paymentId }),
            userId: ownerId
        });
        if (!receipt) throw new Error('Expected own receipt');

        const details = await readReceiptDetails({ receipt });

        expect(details.method).toBe('MERCADOPAGO');
        // The open row wins although the released one was credited later.
        expect(details.periodStart).toEqual(new Date('2026-10-01T03:00:00.000Z'));
        expect(details.periodEnd).toEqual(new Date('2026-11-01T03:00:00.000Z'));
        expect(details.cycle).toBe('monthly');
    });
});
