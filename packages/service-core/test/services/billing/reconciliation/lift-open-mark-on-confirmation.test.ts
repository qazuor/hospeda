import { reconciliationMarkModel, SYSTEM_USER_ID } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceError } from '../../../../src/types';

const { liftMock } = vi.hoisted(() => ({ liftMock: vi.fn() }));

vi.mock(
    '../../../../src/services/billing/reconciliation/lift-reconciliation-mark.service.js',
    () => ({ liftReconciliationMark: liftMock })
);

import { liftOpenMarkOnConfirmation } from '../../../../src/services/billing/reconciliation/lift-open-mark-on-confirmation.js';

const placedAt = new Date('2026-10-14T12:00:00.000Z');
const now = new Date('2026-10-15T12:00:00.000Z');
const openMark = {
    id: 'mark-1',
    subscriptionId: 'subscription-1',
    addonInstanceId: null,
    reason: 'REANUDACION_NO_APLICADA',
    placedAt,
    liftedAt: null,
    liftedBy: null,
    version: 3,
    deadlinesVersion: 1,
    escalatedAt: null
};

const input = {
    tx: {} as never,
    subscriptionId: 'subscription-1',
    reason: 'REANUDACION_NO_APLICADA' as const,
    now
};

const liftError = (reason: string) =>
    new ServiceError(ServiceErrorCode.ALREADY_EXISTS, reason, undefined, reason);

describe('liftOpenMarkOnConfirmation', () => {
    const findOpen = vi.spyOn(reconciliationMarkModel, 'findOpen');

    beforeEach(() => {
        findOpen.mockReset();
        liftMock.mockReset();
    });

    it('returns NONE when the subscription has no open mark for the reason', async () => {
        findOpen.mockResolvedValue(null);

        const result = await liftOpenMarkOnConfirmation(input);

        expect(result).toEqual({ outcome: 'NONE' });
        expect(findOpen).toHaveBeenCalledWith({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: 'subscription-1' },
            reason: 'REANUDACION_NO_APLICADA',
            tx: input.tx
        });
        expect(liftMock).not.toHaveBeenCalled();
    });

    it('lifts the open mark through S15 as the system actor at the read version', async () => {
        findOpen.mockResolvedValue(openMark);
        liftMock.mockResolvedValue({ outcome: 'LIFTED', mark: openMark });

        const result = await liftOpenMarkOnConfirmation(input);

        expect(result).toEqual({ outcome: 'LIFTED' });
        expect(liftMock).toHaveBeenCalledTimes(1);
        const [liftInput, ports] = liftMock.mock.calls[0] ?? [];
        expect(liftInput).toEqual({
            markId: 'mark-1',
            expectedVersion: 3,
            liftedBy: SYSTEM_USER_ID,
            tx: input.tx
        });
        expect(ports.clock.now()).toEqual(now);
    });

    it('keeps the mark open while unresolved payments remain attached', async () => {
        findOpen.mockResolvedValue(openMark);
        liftMock.mockRejectedValue(liftError('MARK_HAS_UNRESOLVED_PAYMENTS'));

        const result = await liftOpenMarkOnConfirmation(input);

        expect(result).toEqual({ outcome: 'SKIPPED_UNRESOLVED_PAYMENTS' });
    });

    it.each([
        'MARK_VERSION_CONFLICT',
        'MARK_NOT_FOUND',
        'MARK_ALREADY_LIFTED'
    ])('treats %s from S15 as NONE', async (reason) => {
        findOpen.mockResolvedValue(openMark);
        liftMock.mockRejectedValue(liftError(reason));

        const result = await liftOpenMarkOnConfirmation(input);

        expect(result).toEqual({ outcome: 'NONE' });
    });

    it('propagates an unexpected S15 failure', async () => {
        findOpen.mockResolvedValue(openMark);
        liftMock.mockRejectedValue(liftError('MARK_INPUT_INVALID'));

        await expect(liftOpenMarkOnConfirmation(input)).rejects.toMatchObject({
            reason: 'MARK_INPUT_INVALID'
        });
    });
});
