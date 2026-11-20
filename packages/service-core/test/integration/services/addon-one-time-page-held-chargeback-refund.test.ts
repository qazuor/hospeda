/**
 * HOS-2179 D1, security review: a chargeback on a held page charge never resolves the payment
 * "without a refund" while a refund may have moved the money. A refund already sent to the
 * provider (`CONFIRMED`) owns the outcome and the chargeback only adds its note; after an
 * `EXECUTED` refund the chargeback writes nothing; a chargeback racing the refund's execution
 * ends in one resolution, by that refund. Runs with the fake, lies on.
 */
import { eq, reconciliationMarkPayments } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { noteChargebackOnHeldCharge } from '../../../src/services/billing/addon/one-time-page-charge-marks';
import { confirmRefund } from '../../../src/services/billing/refund/confirm-refund.service';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { retirePurchaseFixtures } from './support/addon-purchase-fixtures';
import {
    deliver,
    heldChargeFor,
    heldLink,
    liftByAdmin,
    markRow,
    refundsOf,
    takeDue
} from './support/held-charge-refund-fixtures';
import { changeOf, pageMarkEvents, retirePageMarks } from './support/one-time-page-fixtures';
import { seedAdminActor } from './support/refund-fixtures';

const skip = !isServiceTestDbAvailable();

afterEach(async () => {
    vi.restoreAllMocks();
    await retirePageMarks();
    await retirePurchaseFixtures();
});
afterAll(closeServiceTestPool);

/** A held duplicate whose proposed refund a person confirmed: sent to the provider, not executed. */
async function heldWithConfirmedRefund() {
    const arranged = await heldChargeFor('COBRO_DUPLICADO');
    const [proposal] = await refundsOf(arranged.held.payment.id);
    if (!proposal) throw new Error('proposal missing');
    const person = await seedAdminActor([PermissionEnum.BILLING_REFUND]);
    await confirmRefund(
        { actor: person, refundId: proposal.id },
        { clock: arranged.s.f.ports.clock, provider: arranged.s.f.fake }
    );
    expect((await refundsOf(arranged.held.payment.id))[0]?.status).toBe('CONFIRMED');
    const refundNotice = takeDue(arranged.s);
    expect(refundNotice.length).toBeGreaterThan(0);
    return { ...arranged, proposal, refundNotice };
}

/** The chargeback as the notice or the sweep would hand it over. */
function chargeback(arranged: {
    readonly instance: { readonly id: string };
    readonly chargeId: string;
    readonly s: Awaited<ReturnType<typeof heldChargeFor>>['s'];
}) {
    return noteChargebackOnHeldCharge({
        instanceId: arranged.instance.id,
        chargeId: arranged.chargeId,
        trigger: { actor: 'provider' },
        clock: arranged.s.f.ports.clock
    });
}

/** The mark events of the instance that note a chargeback of this charge. */
async function chargebackNotes(instanceId: string, chargeId: string) {
    return (await pageMarkEvents(instanceId)).filter(
        (event) =>
            changeOf(event, 'provider.charged_back') === true &&
            changeOf(event, 'provider.charge_id') === chargeId
    );
}

/** Every attachment of the payment to a mark. */
async function linksOf(paymentId: string) {
    return getServiceTestDb()
        .select()
        .from(reconciliationMarkPayments)
        .where(eq(reconciliationMarkPayments.paymentId, paymentId));
}

describe('HOS-2179 D1 a chargeback never resolves a held charge a refund owns', () => {
    it.skipIf(skip)(
        'with a CONFIRMED refund in flight: only the note, and the refund settles it',
        async () => {
            // Arrange
            const arranged = await heldWithConfirmedRefund();
            const { s, instance, chargeId, held, proposal, refundNotice } = arranged;

            // Act
            const outcome = await chargeback(arranged);

            // Assert: nothing was resolved and the refund was left to the provider.
            expect(outcome).toBe('DEFERRED_TO_REFUND');
            expect((await refundsOf(held.payment.id))[0]?.status).toBe('CONFIRMED');
            expect(await heldLink(held.payment.id)).toMatchObject({
                resolvedAt: null,
                refundId: null
            });
            expect(await chargebackNotes(instance.id, chargeId)).toHaveLength(1);

            // Act: the refund's notice arrives.
            await deliver(s, refundNotice);

            // Assert: the refund executed and is what resolved the payment.
            expect((await refundsOf(held.payment.id))[0]?.status).toBe('EXECUTED');
            expect(await heldLink(held.payment.id)).toMatchObject({ refundId: proposal.id });
            await liftByAdmin(s, held.markId);
            expect((await markRow(held.markId)).liftedAt).not.toBeNull();
        }
    );

    it.skipIf(skip)('after the refund EXECUTED: writes nothing', async () => {
        // Arrange
        const arranged = await heldWithConfirmedRefund();
        const { s, instance, chargeId, held, proposal, refundNotice } = arranged;
        await deliver(s, refundNotice);
        const settled = await heldLink(held.payment.id);
        expect(settled.refundId).toBe(proposal.id);
        const mark = await markRow(held.markId);

        // Act
        const outcome = await chargeback(arranged);

        // Assert
        expect(outcome).toBe('ALREADY_SETTLED');
        expect(await heldLink(held.payment.id)).toEqual(settled);
        expect((await refundsOf(held.payment.id)).map((refund) => refund.status)).toEqual([
            'EXECUTED'
        ]);
        expect(await chargebackNotes(instance.id, chargeId)).toHaveLength(0);
        expect((await markRow(held.markId)).version).toBe(mark.version);
    });

    it.skipIf(skip)('racing the refund execution: one resolution, by the refund', async () => {
        // Arrange
        const arranged = await heldWithConfirmedRefund();
        const { s, held, proposal, refundNotice } = arranged;

        // Act
        const [, outcome] = await Promise.all([deliver(s, refundNotice), chargeback(arranged)]);

        // Assert
        expect(['DEFERRED_TO_REFUND', 'ALREADY_SETTLED']).toContain(outcome);
        expect((await refundsOf(held.payment.id)).map((refund) => refund.status)).toEqual([
            'EXECUTED'
        ]);
        const links = await linksOf(held.payment.id);
        expect(links).toHaveLength(1);
        expect(links[0]?.resolvedAt).not.toBeNull();
        expect(links[0]?.refundId).toBe(proposal.id);
    });
});
