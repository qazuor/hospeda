/**
 * TEST:B5:12 (HOS-1543), the successor case through the route of admin action 8 with reason
 * revocation: a seeded successor living on credit has no credited payment of its own, so the
 * last credited payment is its predecessor's, found by `sucedida_por` (`succeeded_by_id`).
 * The preview shows that payment and the act requests the RF1 over it, for its total
 * (AC:B5:22). An RF1 in zero or without a payment would mean the row was read, not the chain.
 *
 * Seeds its own rows with random ids and retires only them; never TRUNCATE.
 */
import {
    SubscriptionRevocationPreviewResponseSchema,
    SubscriptionRevocationResponseSchema
} from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    CHARGED_AT,
    REVOKER_PERMISSIONS,
    retireRevocationRouteRows,
    revocationWrites,
    routeClock,
    routeFake,
    seedCreditedPayment,
    seedPrincipal,
    seedUser
} from './revocation-route-fixtures';

/** The predecessor's charge, deliberately different from the anchored price of either row. */
const PREDECESSOR_AMOUNT = 7300;

const clock = routeClock();
let app: ReturnType<typeof initApp>;
let revokerId: string;

const pathOf = (subscriptionId: string) =>
    `/api/v1/admin/billing-subscription/${subscriptionId}/revocation`;

describe('TEST:B5:12 AC:B5:22 the revocation of a successor living on credit, through the route', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        app = initApp({ clock, paymentProvider: routeFake(clock) });
        revokerId = await seedUser('revoker');
    });
    afterAll(async () => {
        await retireRevocationRouteRows();
        await testDb.teardown();
    });

    it("the preview shows the PREDECESSOR's payment and the act requests the RF1 over it, for its total", async () => {
        // Arrange: the successor has no payment; its predecessor was charged on day 0
        const ownerId = await seedUser('successor-owner');
        const successorId = await seedPrincipal({ ownerId });
        const predecessorId = await seedPrincipal({
            ownerId,
            status: 'CANCELLED',
            succeededById: successorId
        });
        const paymentId = await seedCreditedPayment({
            subscriptionId: predecessorId,
            amount: PREDECESSOR_AMOUNT
        });
        const headers = actorHeaders({
            id: revokerId,
            role: 'SUPER_ADMIN',
            permissions: REVOKER_PERMISSIONS
        });

        // Act
        const shown = await app.request(pathOf(successorId), { method: 'GET', headers });
        const acted = await app.request(pathOf(successorId), {
            method: 'POST',
            headers,
            body: JSON.stringify({ expectedPaymentId: paymentId })
        });

        // Assert
        expect(shown.status).toBe(200);
        expect(
            SubscriptionRevocationPreviewResponseSchema.parse((await shown.json()).data).payment
        ).toEqual({
            source: 'PAYMENT',
            id: paymentId,
            amount: PREDECESSOR_AMOUNT,
            currency: 'ARS',
            chargedAt: CHARGED_AT.toISOString(),
            ownerSubscriptionId: predecessorId
        });
        expect(acted.status).toBe(200);
        const body = SubscriptionRevocationResponseSchema.parse((await acted.json()).data);
        expect(body).toMatchObject({
            subscriptionId: successorId,
            status: 'CANCELLED',
            refundAmount: PREDECESSOR_AMOUNT,
            payment: { source: 'PAYMENT', id: paymentId }
        });
        const predecessor = await revocationWrites({ subscriptionId: predecessorId, ownerId });
        expect(predecessor.refunds).toHaveLength(1);
        expect(predecessor.refunds[0]).toMatchObject({
            id: body.refundId,
            paymentId,
            amount: PREDECESSOR_AMOUNT,
            reason: 'REVOCATION',
            status: 'REQUESTED'
        });
        expect((await revocationWrites({ subscriptionId: successorId, ownerId })).row?.status).toBe(
            'CANCELLED'
        );
    });
});
