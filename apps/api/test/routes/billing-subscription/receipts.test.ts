/**
 * The own-receipt routes (HOS-2566): the session decides, a foreign receipt is
 * indistinguishable from a missing one, and the file is a PDF.
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createErrorHandler } from '../../../src/middlewares/response';
import {
    protectedGetOwnReceiptPdfRoute,
    protectedListOwnReceiptsRoute
} from '../../../src/routes/billing-subscription/receipts';
import type { AppBindings } from '../../../src/types';

const mocks = vi.hoisted(() => ({ readOwn: vi.fn(), listOwn: vi.fn(), readDetails: vi.fn() }));
vi.mock('../../../src/services/payment-receipt/receipt-read', () => ({
    readOwnReceipt: mocks.readOwn,
    listOwnReceipts: mocks.listOwn
}));
vi.mock('../../../src/services/payment-receipt/receipt-details-read', async (importOriginal) => ({
    ...(await importOriginal<
        typeof import('../../../src/services/payment-receipt/receipt-details-read')
    >()),
    readReceiptDetails: mocks.readDetails
}));

const OWNER = '11111111-1111-4111-8111-111111111111';
const STRANGER = '22222222-2222-4222-8222-222222222222';
const RECEIPT = '33333333-3333-4333-8333-333333333333';
const stored = {
    id: RECEIPT,
    receiptNumber: 7,
    issuedAt: new Date('2026-11-01T12:00:00.000Z'),
    payerName: 'Ana',
    payerEmail: 'ana@example.com',
    amountMinor: 500000,
    currency: 'ARS',
    concept: { kind: 'PLAN', name: 'Pro' }
};

function app(actorId: string, permissions: PermissionEnum[]) {
    const router = new Hono<AppBindings>();
    router.onError(createErrorHandler());
    router.use((ctx, next) => {
        ctx.set('actor', { id: actorId, roles: [RoleEnum.USER], permissions, emailVerified: true });
        return next();
    });
    router.route('/protected/billing-subscription', protectedListOwnReceiptsRoute);
    router.route('/protected/billing-subscription', protectedGetOwnReceiptPdfRoute);
    return router;
}

beforeEach(() => {
    vi.clearAllMocks();
    // The ownership test is in the query: the fake honours the userId it is given.
    mocks.readOwn.mockImplementation(
        async ({ receiptId, userId }: { receiptId: string; userId: string }) =>
            receiptId === RECEIPT && userId === OWNER ? stored : null
    );
    mocks.listOwn.mockImplementation(async ({ userId }: { userId: string }) =>
        userId === OWNER ? [stored] : []
    );
    mocks.readDetails.mockResolvedValue({
        accountName: 'Ana',
        accountEmail: 'ana@example.com',
        vertical: 'accommodation',
        productName: 'Pro',
        cycle: 'monthly',
        periodStart: new Date('2026-11-01T03:00:00.000Z'),
        periodEnd: new Date('2026-12-01T03:00:00.000Z'),
        method: 'MERCADOPAGO',
        operationId: '123',
        paidAt: new Date('2026-11-01T12:00:00.000Z'),
        promoCodes: [],
        planTrusted: true
    });
});

describe('GET receipts/{id}/pdf', () => {
    const path = `/protected/billing-subscription/receipts/${RECEIPT}/pdf`;
    const view = [PermissionEnum.BILLING_VIEW_OWN];

    it('serves the owner a PDF and asks the read for the actor, not for a param', async () => {
        const response = await app(OWNER, view).request(path);
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/pdf');
        expect(response.headers.get('Cache-Control')).toBe('private, no-store');
        const bytes = new Uint8Array(await response.arrayBuffer());
        expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
        expect(mocks.readOwn).toHaveBeenCalledWith({ receiptId: RECEIPT, userId: OWNER });
        // HOS-2682: the details are read only for the receipt the owner's read returned.
        expect(mocks.readDetails).toHaveBeenCalledWith({ receipt: stored });
    });

    it('still serves the receipt when its details cannot be read (HOS-2682)', async () => {
        mocks.readDetails.mockRejectedValueOnce(new Error('db down'));
        const response = await app(OWNER, view).request(path);
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/pdf');
    });

    it("never reads details for a receipt that is not the actor's", async () => {
        await app(STRANGER, view).request(path);
        expect(mocks.readDetails).not.toHaveBeenCalled();
    });

    it('answers a foreign receipt with the same 404 as a missing one', async () => {
        const caller = app(STRANGER, view);
        const foreign = await caller.request(path);
        const missing = await caller.request(
            `/protected/billing-subscription/receipts/${crypto.randomUUID()}/pdf`
        );
        expect(foreign.status).toBe(404);
        expect(missing.status).toBe(404);
        expect((await foreign.json()).error).toEqual((await missing.json()).error);
    });

    it('refuses an actor without BILLING_VIEW_OWN before reading anything', async () => {
        const response = await app(OWNER, []).request(path);
        expect(response.status).toBe(403);
        expect(mocks.readOwn).not.toHaveBeenCalled();
    });

    it('rejects a malformed id as a 400, not a 404', async () => {
        const response = await app(OWNER, view).request(
            '/protected/billing-subscription/receipts/not-a-uuid/pdf'
        );
        expect(response.status).toBe(400);
    });
});

describe('GET receipts', () => {
    it('lists only what the read returns for the actor, as ISO strings', async () => {
        const response = await app(OWNER, [PermissionEnum.BILLING_VIEW_OWN]).request(
            '/protected/billing-subscription/receipts'
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        const receipts = (body.data ?? body).receipts;
        expect(receipts).toEqual([
            {
                id: RECEIPT,
                receiptNumber: 7,
                issuedAt: '2026-11-01T12:00:00.000Z',
                amountMinor: 500000,
                currency: 'ARS',
                conceptKind: 'PLAN',
                conceptName: 'Pro'
            }
        ]);
        expect(mocks.listOwn).toHaveBeenCalledWith({ userId: OWNER });
    });

    it('returns an empty list to an account with no receipts', async () => {
        const response = await app(STRANGER, [PermissionEnum.BILLING_VIEW_OWN]).request(
            '/protected/billing-subscription/receipts'
        );
        const body = await response.json();
        expect((body.data ?? body).receipts).toEqual([]);
    });
});
