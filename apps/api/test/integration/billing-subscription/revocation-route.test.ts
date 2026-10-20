/**
 * TEST:B5:11 (HOS-1543), admin action 8 with reason revocation through its route:
 * `GET`/`POST /api/v1/admin/billing-subscription/{subscriptionId}/revocation`. The preview
 * says the three things and writes nothing; the act cancels, ends the service and requests
 * the RF1 in one act (AC:B5:20); a charge older than 10 days is refused (AC:B5:21); and every
 * outcome of the provider half answers a body its response schema accepts.
 *
 * Seeds its own rows with random ids and retires only them; never TRUNCATE.
 */
import {
    SubscriptionRevocationPreviewResponseSchema,
    SubscriptionRevocationResponseSchema
} from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { AuditEventType } from '../../../src/utils/audit-logger';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    CHARGED_12_DAYS_AGO,
    CHARGED_AT,
    decisionsOf,
    failingCancel,
    NOW,
    OPTION_AMOUNT,
    presetBeforeCancelNotice,
    REVOKER_PERMISSIONS,
    refundsOfManualPayment,
    retireRevocationRouteRows,
    revocationWrites,
    routeClock,
    routeFake,
    seedCardRevocable,
    seedManualPayment,
    seedOneTimeOrphan,
    seedPrincipal,
    seedRevocable,
    seedUser,
    WINDOW_ENDS_AT
} from './revocation-route-fixtures';

const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    auditLog: audit
}));

const clock = routeClock();
const fake = routeFake(clock);
let app: ReturnType<typeof initApp>;
let revokerId: string;

const pathOf = (subscriptionId: string) =>
    `/api/v1/admin/billing-subscription/${subscriptionId}/revocation`;

function asRevoker() {
    return actorHeaders({ id: revokerId, role: 'SUPER_ADMIN', permissions: REVOKER_PERMISSIONS });
}

function preview(subscriptionId: string) {
    return app.request(pathOf(subscriptionId), { method: 'GET', headers: asRevoker() });
}

function revoke(subscriptionId: string, body: Record<string, unknown>) {
    return app.request(pathOf(subscriptionId), {
        method: 'POST',
        headers: asRevoker(),
        body: JSON.stringify(body)
    });
}

/** The revocation was not audited (a refused request may still leave an ACCESS_DENIED record). */
function expectNoRevocationAudit() {
    expect(audit).not.toHaveBeenCalledWith(
        expect.objectContaining({ auditEvent: AuditEventType.BILLING_MUTATION })
    );
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    app = initApp({ clock, paymentProvider: fake });
    revokerId = await seedUser('revoker');
});
beforeEach(() => {
    audit.mockClear();
    clock.set(NOW);
    injectPaymentProvider({ provider: fake });
});
afterEach(async () => {
    await retireRevocationRouteRows();
});
afterAll(async () => {
    await retireRevocationRouteRows();
    await testDb.teardown();
});

describe('TEST:B5:11 AC:B5:20 AC:B5:21 the revocation by admin action 8', () => {
    it('(a) AC:B5:20 the preview says the payment, its amount, the window end and the three effects, and writes nothing', async () => {
        // Arrange
        const seeded = await seedRevocable();
        const before = await revocationWrites(seeded);

        // Act
        const response = await preview(seeded.subscriptionId);

        // Assert
        expect(response.status).toBe(200);
        const body = (await response.json()).data;
        expect(SubscriptionRevocationPreviewResponseSchema.parse(body)).toEqual({
            subscriptionId: seeded.subscriptionId,
            origin: 'ACTIVE',
            payment: {
                source: 'PAYMENT',
                id: seeded.paymentId,
                amount: OPTION_AMOUNT,
                currency: 'ARS',
                chargedAt: CHARGED_AT.toISOString(),
                ownerSubscriptionId: seeded.subscriptionId
            },
            windowEndsAt: WINDOW_ENDS_AT.toISOString(),
            effects: { cancelsAuthorization: false, endsServiceAt: 'NOW', requestsRefund: true }
        });
        expect(await revocationWrites(seeded)).toEqual(before);
        expect(audit).toHaveBeenCalledWith(
            expect.objectContaining({
                auditEvent: AuditEventType.BILLING_READ,
                actorId: revokerId,
                resourceId: seeded.subscriptionId,
                metadata: { subjectId: seeded.ownerId }
            })
        );
        expectNoRevocationAudit();
    });

    it('(b) AC:B5:20 the act cancels, ends the service now, requests the RF1 for the total, records S36 and is audited', async () => {
        // Arrange
        const seeded = await seedCardRevocable({ fake, clock });
        const shown = (await (await preview(seeded.subscriptionId)).json()).data;
        expect(shown.effects.cancelsAuthorization).toBe(true);
        audit.mockClear();

        // Act
        const response = await revoke(seeded.subscriptionId, {
            expectedPaymentId: shown.payment.id,
            note: 'asked by phone'
        });

        // Assert
        expect(response.status).toBe(200);
        const body = SubscriptionRevocationResponseSchema.parse((await response.json()).data);
        expect(body).toMatchObject({
            subscriptionId: seeded.subscriptionId,
            status: 'CANCELLED',
            origin: 'ACTIVE',
            refundAmount: OPTION_AMOUNT,
            payment: { source: 'PAYMENT', id: seeded.paymentId },
            cancelCall: 'NOTICE_PENDING'
        });
        const after = await revocationWrites(seeded);
        expect(after.row?.status).toBe('CANCELLED');
        expect(after.row?.serviceEndsAt?.toISOString()).toBe(body.serviceEndedAt);
        expect(after.refunds).toHaveLength(1);
        expect(after.refunds[0]).toMatchObject({
            id: body.refundId,
            paymentId: seeded.paymentId,
            amount: OPTION_AMOUNT,
            reason: 'REVOCATION',
            status: 'REQUESTED'
        });
        const decisions = await decisionsOf(seeded.subscriptionId);
        expect(decisions).toHaveLength(1);
        expect(JSON.stringify(decisions[0])).toContain('S36');
        expect(audit).toHaveBeenCalledWith(
            expect.objectContaining({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: revokerId,
                action: 'update',
                resourceType: 'subscription',
                resourceId: seeded.subscriptionId,
                metadata: {
                    administrativeAction: 'ACC_8',
                    transition: 'S36',
                    motive: 'REVOCATION',
                    subjectId: seeded.ownerId,
                    origin: 'ACTIVE',
                    orphanedAddonIds: [],
                    refundId: body.refundId,
                    paymentId: seeded.paymentId,
                    refundAmount: OPTION_AMOUNT,
                    cancelCall: 'NOTICE_PENDING',
                    note: 'asked by phone'
                }
            })
        );
    });

    it('(c) AC:B5:20 a second act answers 409 REVOCATION_STATE_NOT_ALLOWED and requests no second RF1', async () => {
        // Arrange
        const seeded = await seedRevocable();
        expect(
            (await revoke(seeded.subscriptionId, { expectedPaymentId: seeded.paymentId })).status
        ).toBe(200);
        audit.mockClear();

        // Act
        const response = await revoke(seeded.subscriptionId, {
            expectedPaymentId: seeded.paymentId
        });

        // Assert
        expect(response.status).toBe(409);
        expect((await response.json()).error).toMatchObject({
            code: 'ALREADY_EXISTS',
            reason: 'REVOCATION_STATE_NOT_ALLOWED'
        });
        expect((await revocationWrites(seeded)).refunds).toHaveLength(1);
        expectNoRevocationAudit();
    });

    it('(d) AC:B5:21 a charge of 12 days ago answers 422 REVOCATION_WINDOW_CLOSED to the preview and the act, writing nothing', async () => {
        // Arrange
        const seeded = await seedRevocable({ factAt: CHARGED_12_DAYS_AGO });
        const before = await revocationWrites(seeded);

        // Act
        const shown = await preview(seeded.subscriptionId);
        const acted = await revoke(seeded.subscriptionId, { expectedPaymentId: seeded.paymentId });

        // Assert
        for (const response of [shown, acted]) {
            expect(response.status).toBe(422);
            expect((await response.json()).error).toMatchObject({
                code: 'VALIDATION_ERROR',
                reason: 'REVOCATION_WINDOW_CLOSED'
            });
        }
        expect(await revocationWrites(seeded)).toEqual(before);
        expectNoRevocationAudit();
    });

    it('(e) AC:B5:20 a payment other than the one the preview showed answers 409 REVOCATION_PAYMENT_CHANGED, writing nothing', async () => {
        // Arrange
        const seeded = await seedRevocable();
        const other = await seedRevocable();
        const before = await revocationWrites(seeded);

        // Act
        const response = await revoke(seeded.subscriptionId, {
            expectedPaymentId: other.paymentId
        });

        // Assert
        expect(response.status).toBe(409);
        expect((await response.json()).error).toMatchObject({
            code: 'ALREADY_EXISTS',
            reason: 'REVOCATION_PAYMENT_CHANGED'
        });
        expect(await revocationWrites(seeded)).toEqual(before);
        expectNoRevocationAudit();
    });

    it('(f) a missing subscription answers 404; a non-uuid id and a body without expectedPaymentId answer 400', async () => {
        // Arrange
        const seeded = await seedRevocable();
        const before = await revocationWrites(seeded);

        // Act
        const missing = await revoke(crypto.randomUUID(), { expectedPaymentId: seeded.paymentId });
        const missingPreview = await preview(crypto.randomUUID());
        const notUuid = await revoke('not-a-uuid', { expectedPaymentId: seeded.paymentId });
        const noPayment = await revoke(seeded.subscriptionId, {});
        const extraKey = await revoke(seeded.subscriptionId, {
            expectedPaymentId: seeded.paymentId,
            amount: 1
        });

        // Assert
        for (const response of [missing, missingPreview]) {
            expect(response.status).toBe(404);
            expect((await response.json()).error).toMatchObject({
                code: 'NOT_FOUND',
                reason: 'SUBSCRIPTION_NOT_FOUND'
            });
        }
        expect(notUuid.status).toBe(400);
        expect(noPayment.status).toBe(400);
        expect(extraKey.status).toBe(400);
        expect(await revocationWrites(seeded)).toEqual(before);
        expectNoRevocationAudit();
    });
});

describe('TEST:B5:11 AC:B5:20 every outcome of the provider half answers a valid body', () => {
    async function revokedBody(subscriptionId: string, expectedPaymentId: string) {
        const response = await revoke(subscriptionId, { expectedPaymentId });
        expect(response.status).toBe(200);
        return SubscriptionRevocationResponseSchema.parse((await response.json()).data);
    }

    it('TEST:B5:12 AC:B5:24 keeps the response schema and audits orphaned addon ids', async () => {
        const seeded = await seedRevocable();
        const addon = await seedOneTimeOrphan({
            ownerId: seeded.ownerId,
            principalId: seeded.subscriptionId
        });
        const response = await revoke(seeded.subscriptionId, {
            expectedPaymentId: seeded.paymentId
        });
        expect(response.status).toBe(200);
        const body = SubscriptionRevocationResponseSchema.parse((await response.json()).data);
        expect(body).toMatchObject({ subscriptionId: seeded.subscriptionId, status: 'CANCELLED' });
        expect(audit).toHaveBeenCalledWith(
            expect.objectContaining({
                auditEvent: AuditEventType.BILLING_MUTATION,
                metadata: expect.objectContaining({ orphanedAddonIds: [addon.instanceId] })
            })
        );
    });

    it('(g) NOT_APPLICABLE: a row without provider link', async () => {
        const seeded = await seedRevocable();

        const body = await revokedBody(seeded.subscriptionId, seeded.paymentId);

        expect(body).toMatchObject({ cancelCall: 'NOT_APPLICABLE' });
        expect(body.escalated).toBeUndefined();
    });

    it('(g) NOT_NEEDED: the preapproval was already cancelled at the provider', async () => {
        const seeded = await seedCardRevocable({ fake, clock });
        await fake.cancel({ authorizationId: seeded.authorizationId });

        const body = await revokedBody(seeded.subscriptionId, seeded.paymentId);

        expect(body).toMatchObject({ cancelCall: 'NOT_NEEDED' });
    });

    it('(g) NOTICE_PENDING: the real outbox has not sent the notice yet, so nothing is called', async () => {
        const seeded = await seedCardRevocable({ fake, clock });

        const body = await revokedBody(seeded.subscriptionId, seeded.paymentId);

        expect(body).toMatchObject({ cancelCall: 'NOTICE_PENDING' });
        expect(body.escalated).toBeUndefined();
        const read = await fake.readAuthorization({ authorizationId: seeded.authorizationId });
        expect(read.snapshot.status).not.toBe('cancelled');
    });

    it('(g) SENT: the notice went out and the call was applied', async () => {
        const seeded = await seedCardRevocable({ fake, clock });
        await presetBeforeCancelNotice({ ...seeded, status: 'sent' });

        const body = await revokedBody(seeded.subscriptionId, seeded.paymentId);

        expect(body).toMatchObject({ cancelCall: 'SENT' });
        expect(body.escalated).toBeUndefined();
        const read = await fake.readAuthorization({ authorizationId: seeded.authorizationId });
        expect(read.snapshot.status).toBe('cancelled');
    });

    it('(g) FAILED: the call was not applied; the row is CANCELLED anyway', async () => {
        const seeded = await seedCardRevocable({ fake, clock });
        await presetBeforeCancelNotice({ ...seeded, status: 'sent' });
        injectPaymentProvider({ provider: failingCancel(fake) });

        const body = await revokedBody(seeded.subscriptionId, seeded.paymentId);

        expect(body).toMatchObject({ cancelCall: 'FAILED', status: 'CANCELLED' });
        expect((await revocationWrites(seeded)).row?.status).toBe('CANCELLED');
    });

    it.each([
        ['NO_RECIPIENT', 'undeliverable:hard_bounce'],
        ['DELIVERY_EXHAUSTED', 'smtp:timeout']
    ] as const)('(g) escalated %s: the notice is undeliverable and the call goes anyway', async (escalated, lastError) => {
        const seeded = await seedCardRevocable({ fake, clock });
        await presetBeforeCancelNotice({ ...seeded, status: 'failed', lastError });

        const body = await revokedBody(seeded.subscriptionId, seeded.paymentId);

        expect(body).toMatchObject({ cancelCall: 'SENT', escalated });
    });

    it('(g) a manual payer: the RF1 hangs from the manual payment at the anchored price', async () => {
        // Arrange
        const ownerId = await seedUser('manual-owner');
        const subscriptionId = await seedPrincipal({ ownerId, paymentMethod: 'MANUAL' });
        const manualPaymentId = await seedManualPayment({
            subscriptionId,
            registeredBy: revokerId
        });
        const shown = (await (await preview(subscriptionId)).json()).data;

        // Act
        const body = await revokedBody(subscriptionId, manualPaymentId);

        // Assert
        expect(SubscriptionRevocationPreviewResponseSchema.parse(shown).payment).toMatchObject({
            source: 'MANUAL_PAYMENT',
            id: manualPaymentId,
            amount: OPTION_AMOUNT
        });
        expect(body).toMatchObject({
            cancelCall: 'NOT_APPLICABLE',
            refundAmount: OPTION_AMOUNT,
            payment: { source: 'MANUAL_PAYMENT', id: manualPaymentId }
        });
        const rows = await refundsOfManualPayment(manualPaymentId);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ amount: OPTION_AMOUNT, reason: 'REVOCATION' });
    });
});
