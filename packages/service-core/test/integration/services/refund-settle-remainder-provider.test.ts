/**
 * HOS-2406: accepted is not credited. The remainder settlement reads the charge by id, as RF3 does:
 * every accepted call must be a credited provider refund on it (and the credited sum is the
 * provider's, not what we asked), and the panel reference must be a credited provider refund of
 * exactly the remainder. Also step 3 against the subject and a reference another refund settled.
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers.js';
import {
    creditedPayment,
    paymentRow,
    refundById,
    seedAdminActor,
    settleOnPayment
} from './support/refund-fixtures.js';
import {
    panelRefund,
    partiallyAcceptedRefund,
    settleRemainder
} from './support/refund-remainder-fixtures.js';

afterAll(closeServiceTestPool);

const skip = !isServiceTestDbAvailable();

type Arranged = Awaited<ReturnType<typeof partiallyAcceptedRefund>>;

async function expectUntouched(arranged: Arranged) {
    expect(await refundById(arranged.refundId)).toMatchObject({
        status: 'CONFIRMED',
        executedVia: null,
        externalRef: null,
        settledBy: null
    });
    expect(await paymentRow(arranged.credited.payment.id)).toMatchObject({
        status: 'SUCCEEDED',
        refundedAmount: 0
    });
}

describe('HOS-2406 the accepted part counts only as the provider credited it', () => {
    it.skipIf(skip)('owes what the provider credited, not what the call asked for', async () => {
        // Arrange: the call asked 4000 and the provider returned 3000.
        const arranged = await partiallyAcceptedRefund([
            { kind: 'ACCEPTED', amount: 4000, providerAmount: 3000 },
            { kind: 'REJECTED', amount: 2000 }
        ]);

        // Act
        const asked = await settleRemainder(arranged.settler, arranged).catch(
            (error: unknown) => error
        );
        const credited = await settleRemainder(arranged.settler, arranged, {
            amount: 3000,
            reference: await panelRefund(arranged, 3000)
        });

        // Assert
        expect(asked).toMatchObject({
            reason: 'REMAINDER_AMOUNT_MISMATCH',
            message: expect.stringContaining('must be 3000')
        });
        expect(credited).toMatchObject({ acceptedAmount: 3000, remainderAmount: 3000 });
        expect((await paymentRow(arranged.credited.payment.id))?.refundedAmount).toBe(6000);
    });

    it.skipIf(skip)(
        'an accepted call the provider does not report: ACCEPTED_PART_NOT_ACCREDITED',
        async () => {
            // Arrange
            const arranged = await partiallyAcceptedRefund([
                {
                    kind: 'ACCEPTED',
                    amount: 4000,
                    providerRefundId: `mp-ghost-${crypto.randomUUID()}`
                },
                { kind: 'REJECTED', amount: 2000 }
            ]);

            // Act
            const settled = settleRemainder(arranged.settler, arranged);

            // Assert
            await expect(settled).rejects.toMatchObject({
                code: 'ALREADY_EXISTS',
                reason: 'ACCEPTED_PART_NOT_ACCREDITED'
            });
            await expectUntouched(arranged);
        }
    );

    it.skipIf(skip)(
        'an accepted call the provider later rejected: ACCEPTED_PART_NOT_ACCREDITED',
        async () => {
            // Arrange
            const arranged = await partiallyAcceptedRefund();
            const [acceptedId] = arranged.acceptedIds;
            if (!acceptedId) throw new Error('accepted id missing');
            await arranged.credited.fixture.provider.rejectRefund({
                chargeId: arranged.credited.payment.providerFactId,
                refundId: acceptedId
            });

            // Act
            const settled = settleRemainder(arranged.settler, arranged);

            // Assert
            await expect(settled).rejects.toMatchObject({ reason: 'ACCEPTED_PART_NOT_ACCREDITED' });
            await expectUntouched(arranged);
        }
    );
});

describe('HOS-2406 the remainder must be a credited refund at the provider', () => {
    it.skipIf(skip)(
        'a reference the provider does not report: REMAINDER_NOT_FOUND_AT_PROVIDER',
        async () => {
            // Arrange
            const arranged = await partiallyAcceptedRefund();

            // Act
            const settled = settleRemainder(arranged.settler, arranged, {
                reference: `mp-panel-${crypto.randomUUID()}`
            });

            // Assert
            await expect(settled).rejects.toMatchObject({
                code: 'VALIDATION_ERROR',
                reason: 'REMAINDER_NOT_FOUND_AT_PROVIDER'
            });
            await expectUntouched(arranged);
        }
    );

    it.skipIf(skip)(
        'a provider refund of another amount: REMAINDER_NOT_FOUND_AT_PROVIDER',
        async () => {
            // Arrange
            const arranged = await partiallyAcceptedRefund();
            const reference = await panelRefund(arranged, 1999);

            // Act
            const settled = settleRemainder(arranged.settler, arranged, { reference });

            // Assert
            await expect(settled).rejects.toMatchObject({
                reason: 'REMAINDER_NOT_FOUND_AT_PROVIDER'
            });
            await expectUntouched(arranged);
        }
    );

    it.skipIf(skip)(
        'a provider refund the provider rejected: REMAINDER_NOT_FOUND_AT_PROVIDER',
        async () => {
            // Arrange
            const arranged = await partiallyAcceptedRefund();
            const reference = await panelRefund(arranged);
            await arranged.credited.fixture.provider.rejectRefund({
                chargeId: arranged.credited.payment.providerFactId,
                refundId: reference
            });

            // Act
            const settled = settleRemainder(arranged.settler, arranged, { reference });

            // Assert
            await expect(settled).rejects.toMatchObject({
                reason: 'REMAINDER_NOT_FOUND_AT_PROVIDER'
            });
            await expectUntouched(arranged);
        }
    );
});

describe('HOS-2406 step 3 and the panel reference', () => {
    it.skipIf(skip)(
        'the payer settling their own refund: ADMINISTRATIVE_ACTION_FORBIDDEN',
        async () => {
            // Arrange
            const arranged = await partiallyAcceptedRefund();
            const subject = {
                id: arranged.credited.fixture.user.id,
                roles: [RoleEnum.ADMIN],
                permissions: [PermissionEnum.BILLING_SETTLE_EXTERNAL]
            };

            // Act
            const settled = settleRemainder(subject, arranged);

            // Assert
            await expect(settled).rejects.toMatchObject({
                code: 'FORBIDDEN',
                reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'
            });
            await expectUntouched(arranged);
        }
    );

    it.skipIf(skip)(
        "another refund's panel reference: EXTERNAL_REFERENCE_ALREADY_SETTLED",
        async () => {
            // Arrange
            const arranged = await partiallyAcceptedRefund();
            const reference = await panelRefund(arranged);
            const other = await creditedPayment(10000);
            const settler = await seedAdminActor([PermissionEnum.BILLING_SETTLE_EXTERNAL]);
            await settleOnPayment(settler, other, {
                amount: 1000,
                channel: 'PROVIDER_PANEL',
                reference
            });

            // Act
            const settled = settleRemainder(arranged.settler, arranged, { reference });

            // Assert
            await expect(settled).rejects.toMatchObject({
                code: 'ALREADY_EXISTS',
                reason: 'EXTERNAL_REFERENCE_ALREADY_SETTLED'
            });
            await expectUntouched(arranged);
        }
    );
});
