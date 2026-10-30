// TEST:B5:12 (AC:B5:22), only the case of this sheet: a successor living on the credit of
// DEC-SUB-006 has no credited payment, so S36 returns its predecessor's, found by
// `sucedida_por` (I-5). The S19-retained payment (AC:B5:23) and the one-time add-on
// (AC:B5:24) are other sheets.
import { eq, providerLinks, refunds, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { revokeSubscription } from '../../../src/services/billing/subscription/revoke-subscription.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    type RevocationFixture,
    retireRevocationRows,
    revocationFixture,
    seedRevocationActor,
    seedSiblingPrincipal
} from './support/revocation-fixtures.js';

afterEach(retireRevocationRows);
afterAll(closeServiceTestPool);

const live = !isServiceTestDbAvailable();

/** Closes the fixture row as the predecessor of a successor that has its own preapproval. */
async function closedSuccession(f: RevocationFixture, hops: 1 | 2) {
    const db = getServiceTestDb();
    await db
        .update(subscriptions)
        .set({ status: 'CANCELLED' })
        .where(eq(subscriptions.id, f.subscriptionId));
    const mother =
        hops === 2 ? await seedSiblingPrincipal({ like: f, status: 'CANCELLED' }) : undefined;
    const successor = await seedSiblingPrincipal({ like: f, status: 'ACTIVE' });
    const { authorizationId } = await f.fixture.provider.authorize({
        reference: successor.id,
        amount: { amountMinor: 250000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'TEST:B5:12 successor',
        returnUrl: 'https://example.test/return',
        payerEmail: `payer-${crypto.randomUUID()}@example.test`
    });
    await f.fixture.provider.approve({ authorizationId });
    await db.insert(providerLinks).values({
        subscriptionId: successor.id,
        provider: f.fixture.link.provider,
        providerId: authorizationId
    });
    if (mother) {
        await db
            .update(subscriptions)
            .set({ succeededById: mother.id })
            .where(eq(subscriptions.id, f.subscriptionId));
        await db
            .update(subscriptions)
            .set({ succeededById: successor.id })
            .where(eq(subscriptions.id, mother.id));
    } else
        await db
            .update(subscriptions)
            .set({ succeededById: successor.id })
            .where(eq(subscriptions.id, f.subscriptionId));
    return successor;
}

describe('TEST:B5:12 AC:B5:22 a successor living on credit returns its predecessor payment', () => {
    it.skipIf(live)(
        "(a) the RF1 hangs from the PREDECESSOR's payment, for its total; the successor is CANCELLED",
        async () => {
            // Arrange: predecessor credited on day 3, successor without payments
            const f = await revocationFixture({ chargedAt: new Date('2026-10-04T13:00:00.000Z') });
            const successor = await closedSuccession(f, 1);
            f.at(f.day(5));

            // Act
            const result = await revokeSubscription(
                { actor: await seedRevocationActor(), subscriptionId: successor.id },
                f.ports
            );

            // Assert
            expect(result).toMatchObject({
                subscriptionId: successor.id,
                refundAmount: 10000,
                payment: { source: 'PAYMENT', id: f.payment!.id }
            });
            const rows = await getServiceTestDb()
                .select()
                .from(refunds)
                .where(eq(refunds.paymentId, f.payment!.id));
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({
                amount: 10000,
                reason: 'REVOCATION',
                status: 'REQUESTED'
            });
            const [row] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, successor.id));
            expect(row?.status).toBe('CANCELLED');
        }
    );

    it.skipIf(live)(
        "(b) the 10 days count from the predecessor's charge: 12 days later the window is closed",
        async () => {
            // Arrange
            const f = await revocationFixture();
            const successor = await closedSuccession(f, 1);
            f.at(f.day(12));

            // Act / Assert
            await expect(
                revokeSubscription(
                    { actor: await seedRevocationActor(), subscriptionId: successor.id },
                    f.ports
                )
            ).rejects.toMatchObject({ reason: 'REVOCATION_WINDOW_CLOSED' });
            const [row] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, successor.id));
            expect(row?.status).toBe('ACTIVE');
        }
    );

    it.skipIf(live)("(c) two hops: the RF1 hangs from the grandmother's payment", async () => {
        // Arrange
        const f = await revocationFixture();
        const successor = await closedSuccession(f, 2);
        f.at(f.day(5));

        // Act
        const result = await revokeSubscription(
            { actor: await seedRevocationActor(), subscriptionId: successor.id },
            f.ports
        );

        // Assert
        expect(result).toMatchObject({
            refundAmount: 10000,
            payment: { source: 'PAYMENT', id: f.payment!.id }
        });
    });

    it.skipIf(live)(
        '(d) a succession IN PROGRESS (only sucede_a written): NO_CREDITED_PAYMENT, never through succeeds_id',
        async () => {
            // Arrange: the predecessor is still live and has no succeeded_by_id yet
            const f = await revocationFixture();
            const successor = await seedSiblingPrincipal({
                like: f,
                status: 'ACTIVE',
                succeedsId: f.subscriptionId
            });
            f.at(f.day(5));

            // Act / Assert
            await expect(
                revokeSubscription(
                    { actor: await seedRevocationActor(), subscriptionId: successor.id },
                    f.ports
                )
            ).rejects.toMatchObject({ reason: 'REVOCATION_NO_CREDITED_PAYMENT' });
            expect(
                await getServiceTestDb()
                    .select()
                    .from(refunds)
                    .where(eq(refunds.paymentId, f.payment!.id))
            ).toEqual([]);
        }
    );
});
