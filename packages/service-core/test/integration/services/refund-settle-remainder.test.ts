/**
 * HOS-2406: action 14 over a CONFIRMED refund the provider accepted only in part. The remainder
 * refunded by hand from the provider panel closes the refund EXECUTED for its full amount, and the
 * payment's refunded amount squares. Every other state is a typed rejection that moves nothing.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers.js';
import { paymentRow, refundById, seedAdminActor } from './support/refund-fixtures.js';
import {
    panelRefund,
    partiallyAcceptedRefund,
    settleRemainder
} from './support/refund-remainder-fixtures.js';

afterAll(closeServiceTestPool);

const skip = !isServiceTestDbAvailable();

describe('HOS-2406 the manual remainder closes a partially accepted refund', () => {
    it.skipIf(skip)(
        'closes the refund EXECUTED with the panel record, and the payment counts accepted + remainder',
        async () => {
            // Arrange
            const arranged = await partiallyAcceptedRefund();
            const reference = await panelRefund(arranged);
            const before = await refundById(arranged.refundId);

            // Act
            const result = await settleRemainder(arranged.settler, arranged, { reference });

            // Assert
            expect(result).toEqual({
                refundId: arranged.refundId,
                subjectId: arranged.credited.fixture.user.id,
                acceptedAmount: 4000,
                remainderAmount: 2000,
                paymentOutcome: 'P4',
                coverageReleased: false,
                settledStaleCallKeys: []
            });
            expect(await refundById(arranged.refundId)).toMatchObject({
                status: 'EXECUTED',
                executedVia: 'EXTERNAL',
                externalChannel: 'PROVIDER_PANEL',
                externalRef: reference,
                settledBy: arranged.settler.id,
                confirmedBy: arranged.confirmer.id,
                amount: 6000,
                reason: 'REVOCATION',
                version: (before?.version ?? 0) + 1
            });
            expect(await paymentRow(arranged.credited.payment.id)).toMatchObject({
                status: 'PARTIALLY_REFUNDED',
                refundedAmount: 6000
            });
        }
    );

    it.skipIf(skip)('accepts several accepted calls and sums them', async () => {
        // Arrange
        const arranged = await partiallyAcceptedRefund([
            { kind: 'ACCEPTED', amount: 1500 },
            { kind: 'ACCEPTED', amount: 2500 },
            { kind: 'REJECTED', amount: 2000 }
        ]);

        // Act
        const result = await settleRemainder(arranged.settler, arranged);

        // Assert
        expect(result).toMatchObject({ acceptedAmount: 4000, remainderAmount: 2000 });
        expect((await paymentRow(arranged.credited.payment.id))?.refundedAmount).toBe(6000);
    });
});

describe('HOS-2406 every other state is a typed rejection that moves nothing', () => {
    async function expectUntouched(arranged: Awaited<ReturnType<typeof partiallyAcceptedRefund>>) {
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

    it.skipIf(skip)(
        'a remainder that is not exactly what is owed: REMAINDER_AMOUNT_MISMATCH',
        async () => {
            // Arrange
            const arranged = await partiallyAcceptedRefund();

            // Act
            const tooMuch = settleRemainder(arranged.settler, arranged, { amount: 2001 });
            const tooLittle = settleRemainder(arranged.settler, arranged, { amount: 1999 });

            // Assert
            await expect(tooMuch).rejects.toMatchObject({
                code: 'VALIDATION_ERROR',
                reason: 'REMAINDER_AMOUNT_MISMATCH',
                message: expect.stringContaining('must be 2000')
            });
            await expect(tooLittle).rejects.toMatchObject({ reason: 'REMAINDER_AMOUNT_MISMATCH' });
            await expectUntouched(arranged);
        }
    );

    it.skipIf(skip)(
        'a refund the provider accepted in full owes nothing: REMAINDER_AMOUNT_MISMATCH',
        async () => {
            // Arrange
            const arranged = await partiallyAcceptedRefund([{ kind: 'ACCEPTED', amount: 6000 }]);

            // Act
            const settled = settleRemainder(arranged.settler, arranged, { amount: 1 });

            // Assert
            await expect(settled).rejects.toMatchObject({
                reason: 'REMAINDER_AMOUNT_MISMATCH',
                message: expect.stringContaining('must be 0')
            });
            await expectUntouched(arranged);
        }
    );

    it.skipIf(skip)('no accepted call: REFUND_HAS_NO_ACCEPTED_CALL', async () => {
        // Arrange
        const arranged = await partiallyAcceptedRefund([{ kind: 'REJECTED', amount: 6000 }]);

        // Act
        const settled = settleRemainder(arranged.settler, arranged, { amount: 6000 });

        // Assert
        await expect(settled).rejects.toMatchObject({
            code: 'ALREADY_EXISTS',
            reason: 'REFUND_HAS_NO_ACCEPTED_CALL'
        });
        await expectUntouched(arranged);
    });

    it.skipIf(skip)('a call still unanswered: REFUND_CALL_UNANSWERED', async () => {
        // Arrange
        const arranged = await partiallyAcceptedRefund([
            { kind: 'ACCEPTED', amount: 4000 },
            { kind: 'UNANSWERED', amount: 2000 }
        ]);

        // Act
        const settled = settleRemainder(arranged.settler, arranged);

        // Assert
        await expect(settled).rejects.toMatchObject({
            code: 'ALREADY_EXISTS',
            reason: 'REFUND_CALL_UNANSWERED'
        });
        await expectUntouched(arranged);
    });

    it.skipIf(skip)('a refund that is not CONFIRMED: REFUND_NOT_CONFIRMED', async () => {
        // Arrange
        const arranged = await partiallyAcceptedRefund();
        await settleRemainder(arranged.settler, arranged);

        // Act
        const again = settleRemainder(arranged.settler, arranged);

        // Assert
        await expect(again).rejects.toMatchObject({
            code: 'ALREADY_EXISTS',
            reason: 'REFUND_NOT_CONFIRMED',
            message: expect.stringContaining('EXECUTED')
        });
        expect((await paymentRow(arranged.credited.payment.id))?.refundedAmount).toBe(6000);
    });

    it.skipIf(skip)('an unknown refund: REFUND_NOT_FOUND', async () => {
        // Arrange
        const arranged = await partiallyAcceptedRefund();

        // Act
        const settled = settleRemainder(arranged.settler, {
            ...arranged,
            refundId: crypto.randomUUID()
        });

        // Assert
        await expect(settled).rejects.toMatchObject({
            code: 'NOT_FOUND',
            reason: 'REFUND_NOT_FOUND'
        });
        await expectUntouched(arranged);
    });

    it.skipIf(skip)(
        'a person without action 14 permission: ADMINISTRATIVE_ACTION_FORBIDDEN',
        async () => {
            // Arrange
            const arranged = await partiallyAcceptedRefund();
            const outsider = await seedAdminActor([]);

            // Act
            const settled = settleRemainder(outsider, arranged);

            // Assert
            await expect(settled).rejects.toMatchObject({
                code: 'FORBIDDEN',
                reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'
            });
            await expectUntouched(arranged);
        }
    );

    it.skipIf(skip)(
        'a panel reference already recorded as one of our calls: EXTERNAL_REFERENCE_ALREADY_SETTLED',
        async () => {
            // Arrange
            const arranged = await partiallyAcceptedRefund();
            const [acceptedId] = arranged.acceptedIds;

            // Act
            const settled = settleRemainder(arranged.settler, arranged, { reference: acceptedId });

            // Assert
            await expect(settled).rejects.toMatchObject({
                reason: 'EXTERNAL_REFERENCE_ALREADY_SETTLED'
            });
            await expectUntouched(arranged);
        }
    );

    it.skipIf(skip)(
        'an empty reference or a non-positive amount is rejected before reading',
        async () => {
            // Arrange
            const arranged = await partiallyAcceptedRefund();

            // Act
            const empty = settleRemainder(arranged.settler, arranged, { reference: '' });
            const zero = settleRemainder(arranged.settler, arranged, { amount: 0 });

            // Assert
            await expect(empty).rejects.toMatchObject({ reason: 'EXTERNAL_REFERENCE_INVALID' });
            await expect(zero).rejects.toMatchObject({ reason: 'REFUND_AMOUNT_INVALID' });
            await expectUntouched(arranged);
        }
    );
});
