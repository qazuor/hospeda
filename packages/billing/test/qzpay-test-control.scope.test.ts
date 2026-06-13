/**
 * Unit tests for the scope-matching behavior of the QZPay test-control
 * `failNext` (SPEC-217) and `delayNext` (SPEC-221) queues.
 *
 * Both queues are GLOBAL in-memory structures shared across parallel E2E
 * workers. Scoping an entry by ownerId/subscriptionId prevents one worker's
 * queued failure/delay from being consumed by another worker's call to the
 * same operation. These tests lock in:
 *   (a) a scoped entry is only consumed by a call whose scope matches,
 *   (b) an unscoped entry is consumed by any caller (backward-compat),
 *   (c) FIFO order is preserved within the same scope.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    applyTestControl,
    delayNext,
    failNext,
    getRecordedCalls,
    getTestControlSnapshot,
    resetTestControl
} from '../src/adapters/qzpay-test-control.ts';

const ok = () => Promise.resolve('real-result');

describe('qzpay-test-control — failNext scope matching', () => {
    beforeEach(() => {
        process.env.HOSPEDA_QZPAY_TEST_CONTROL_ENABLED = 'true';
        resetTestControl();
    });

    afterEach(() => {
        resetTestControl();
        process.env.HOSPEDA_QZPAY_TEST_CONTROL_ENABLED = undefined;
    });

    it('(a) a scoped entry is consumed only by a call with the matching scope', async () => {
        // Arrange: failure armed for owner-A only.
        failNext({
            operation: 'startTrial',
            errorCode: 'TIMEOUT',
            errorMessage: 'scoped to owner-A',
            scope: 'owner-A'
        });

        // Act + Assert: a different owner's call does NOT consume it (runs real).
        await expect(applyTestControl('startTrial', { ownerId: 'owner-B' }, ok)).resolves.toBe(
            'real-result'
        );

        // The matching owner's call DOES consume it (throws).
        await expect(applyTestControl('startTrial', { ownerId: 'owner-A' }, ok)).rejects.toThrow(
            'scoped to owner-A'
        );

        // owner-B recorded ok, owner-A recorded failed.
        const calls = getRecordedCalls('startTrial');
        expect(calls).toHaveLength(2);
        expect(calls[0]?.outcome).toBe('ok');
        expect(calls[1]?.outcome).toBe('failed');
    });

    it('(a2) string args (subscriptionId) are used as the scope', async () => {
        // Arrange: failure armed for a specific subscription id.
        failNext({
            operation: 'cancelTrial',
            errorCode: 'MP_CANCEL_FAIL',
            errorMessage: 'scoped to sub-1',
            scope: 'sub-1'
        });

        // A different subscription id does not consume it.
        await expect(applyTestControl('cancelTrial', 'sub-2', ok)).resolves.toBe('real-result');
        // The matching one does.
        await expect(applyTestControl('cancelTrial', 'sub-1', ok)).rejects.toThrow(
            'scoped to sub-1'
        );
    });

    it('(b) an unscoped entry is consumed by any caller (backward-compat)', async () => {
        // Arrange: failure armed with NO scope.
        failNext({
            operation: 'startTrial',
            errorCode: 'TIMEOUT',
            errorMessage: 'matches anyone'
        });

        // Act + Assert: an arbitrary owner consumes it.
        await expect(applyTestControl('startTrial', { ownerId: 'owner-X' }, ok)).rejects.toThrow(
            'matches anyone'
        );

        // Queue drained: the next call runs real.
        await expect(applyTestControl('startTrial', { ownerId: 'owner-X' }, ok)).resolves.toBe(
            'real-result'
        );
    });

    it('(b2) an unscoped entry matches a call with no extractable scope', async () => {
        failNext({
            operation: 'startTrial',
            errorCode: 'TIMEOUT',
            errorMessage: 'no-scope call'
        });

        // args without ownerId → callScope undefined; unscoped entry still matches.
        await expect(applyTestControl('startTrial', { foo: 'bar' }, ok)).rejects.toThrow(
            'no-scope call'
        );
    });

    it('(c) FIFO order is preserved within the same scope', async () => {
        // Arrange: two failures for the same owner, distinct messages.
        failNext({
            operation: 'startTrial',
            errorCode: 'E1',
            errorMessage: 'first',
            scope: 'owner-A'
        });
        failNext({
            operation: 'startTrial',
            errorCode: 'E2',
            errorMessage: 'second',
            scope: 'owner-A'
        });

        // Act + Assert: consumed first-in-first-out.
        await expect(applyTestControl('startTrial', { ownerId: 'owner-A' }, ok)).rejects.toThrow(
            'first'
        );
        await expect(applyTestControl('startTrial', { ownerId: 'owner-A' }, ok)).rejects.toThrow(
            'second'
        );
        // Third call: queue empty → real.
        await expect(applyTestControl('startTrial', { ownerId: 'owner-A' }, ok)).resolves.toBe(
            'real-result'
        );
    });

    it('a scoped entry does not block an unscoped fallthrough for another scope', async () => {
        // Mixed queue: scoped-to-A first, unscoped second.
        failNext({
            operation: 'startTrial',
            errorCode: 'E1',
            errorMessage: 'only-A',
            scope: 'owner-A'
        });
        failNext({
            operation: 'startTrial',
            errorCode: 'E2',
            errorMessage: 'anyone'
        });

        // owner-B skips the scoped-A entry and consumes the unscoped one.
        await expect(applyTestControl('startTrial', { ownerId: 'owner-B' }, ok)).rejects.toThrow(
            'anyone'
        );
        // owner-A still has its scoped entry waiting.
        await expect(applyTestControl('startTrial', { ownerId: 'owner-A' }, ok)).rejects.toThrow(
            'only-A'
        );
    });
});

describe('qzpay-test-control — delayNext scope matching (SPEC-221)', () => {
    beforeEach(() => {
        process.env.HOSPEDA_QZPAY_TEST_CONTROL_ENABLED = 'true';
        resetTestControl();
    });

    afterEach(() => {
        resetTestControl();
        process.env.HOSPEDA_QZPAY_TEST_CONTROL_ENABLED = undefined;
    });

    it('(d1) a scoped delay is consumed only by the matching scope', async () => {
        // Pair each delay with a same-scope failure so the recorded outcome
        // ('delayed-then-failed' vs plain 'failed') reveals whether the delay
        // actually fired — no brittle wall-clock timing assertions needed.
        delayNext('startTrial', 1, 'owner-A');
        failNext({ operation: 'startTrial', errorCode: 'E', errorMessage: 'A', scope: 'owner-A' });
        failNext({ operation: 'startTrial', errorCode: 'E', errorMessage: 'B', scope: 'owner-B' });

        // owner-B does NOT consume the owner-A delay → outcome 'failed'.
        await expect(applyTestControl('startTrial', { ownerId: 'owner-B' }, ok)).rejects.toThrow(
            'B'
        );
        // owner-A consumes its delay → outcome 'delayed-then-failed'.
        await expect(applyTestControl('startTrial', { ownerId: 'owner-A' }, ok)).rejects.toThrow(
            'A'
        );

        const calls = getRecordedCalls('startTrial');
        expect(calls[0]?.outcome).toBe('failed');
        expect(calls[1]?.outcome).toBe('delayed-then-failed');
    });

    it('(d2) an unscoped delay is consumed by any caller (backward-compat)', async () => {
        delayNext('startTrial', 1);
        failNext({ operation: 'startTrial', errorCode: 'E', errorMessage: 'x' });

        await expect(applyTestControl('startTrial', { ownerId: 'whoever' }, ok)).rejects.toThrow(
            'x'
        );
        expect(getRecordedCalls('startTrial')[0]?.outcome).toBe('delayed-then-failed');
        expect(getTestControlSnapshot().delayNextQueueLength).toBe(0);
    });

    it('(d3) a non-matching delay stays queued while the matching one is consumed', async () => {
        delayNext('startTrial', 1, 'owner-A');
        delayNext('startTrial', 1, 'owner-B');

        // owner-A consumes only its own delay; owner-B's remains queued.
        await applyTestControl('startTrial', { ownerId: 'owner-A' }, ok);
        expect(getTestControlSnapshot().delayNextQueueLength).toBe(1);

        // owner-B then consumes the remaining delay.
        await applyTestControl('startTrial', { ownerId: 'owner-B' }, ok);
        expect(getTestControlSnapshot().delayNextQueueLength).toBe(0);
    });
});
