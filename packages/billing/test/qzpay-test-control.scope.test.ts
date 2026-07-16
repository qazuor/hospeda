/**
 * Unit tests for the scope-matching behavior of the QZPay test-control
 * `failNext` (SPEC-217) and `delayNext` (SPEC-221) queues.
 *
 * Both queues are GLOBAL in-memory structures shared across parallel E2E
 * workers. Scoping an entry by customerId/subscriptionId prevents one worker's
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
        // '' rather than undefined: assigning undefined coerces to the STRING
        // "undefined", which is truthy. It happens not to bite here (the gate
        // compares against 'true'), but the pattern is a trap worth not copying.
        process.env.HOSPEDA_QZPAY_TEST_CONTROL_ENABLED = '';
    });

    it('(a) a scoped entry is consumed only by a call with the matching scope', async () => {
        // Arrange: failure armed for cust-A only.
        failNext({
            operation: 'createSubscription',
            errorCode: 'TIMEOUT',
            errorMessage: 'scoped to cust-A',
            scope: 'cust-A'
        });

        // Act + Assert: a different customer's call does NOT consume it (runs real).
        await expect(
            applyTestControl('createSubscription', { customerId: 'cust-B' }, ok)
        ).resolves.toBe('real-result');

        // The matching customer's call DOES consume it (throws).
        await expect(
            applyTestControl('createSubscription', { customerId: 'cust-A' }, ok)
        ).rejects.toThrow('scoped to cust-A');

        // cust-B recorded ok, cust-A recorded failed.
        const calls = getRecordedCalls('createSubscription');
        expect(calls).toHaveLength(2);
        expect(calls[0]?.outcome).toBe('ok');
        expect(calls[1]?.outcome).toBe('failed');
    });

    it('(a2) string args (subscriptionId) are used as the scope', async () => {
        // Arrange: failure armed for a specific subscription id.
        failNext({
            operation: 'cancelSubscription',
            errorCode: 'MP_CANCEL_FAIL',
            errorMessage: 'scoped to sub-1',
            scope: 'sub-1'
        });

        // A different subscription id does not consume it.
        await expect(applyTestControl('cancelSubscription', 'sub-2', ok)).resolves.toBe(
            'real-result'
        );
        // The matching one does.
        await expect(applyTestControl('cancelSubscription', 'sub-1', ok)).rejects.toThrow(
            'scoped to sub-1'
        );
    });

    it('(a3) createSubscription is scoped by customerId, not by the other args', async () => {
        // The resolver reads a specific key per wired operation. If it ever stops
        // reading `customerId`, a scoped entry silently stops matching and falls
        // back to "unscoped only" — parallel E2E workers would then eat each
        // other's armed failures instead of failing loudly. Lock the key in.
        failNext({
            operation: 'createSubscription',
            errorCode: 'API_DOWN',
            errorMessage: 'scoped to cust-A',
            scope: 'cust-A'
        });

        // Same planId, different customer: must NOT consume it.
        await expect(
            applyTestControl('createSubscription', { customerId: 'cust-B', planId: 'plan-1' }, ok)
        ).resolves.toBe('real-result');

        await expect(
            applyTestControl('createSubscription', { customerId: 'cust-A', planId: 'plan-1' }, ok)
        ).rejects.toThrow('scoped to cust-A');
    });

    it('(a4) customerId wins over ownerId when an arg object carries both', async () => {
        failNext({
            operation: 'createSubscription',
            errorCode: 'API_DOWN',
            errorMessage: 'scoped to cust-A',
            scope: 'cust-A'
        });

        // ownerId is still understood for a future owner-scoped operation, but for
        // a call that carries both, the customer is the scope.
        await expect(
            applyTestControl('createSubscription', { customerId: 'cust-A', ownerId: 'owner-Z' }, ok)
        ).rejects.toThrow('scoped to cust-A');
    });

    it('(b) an unscoped entry is consumed by any caller (backward-compat)', async () => {
        // Arrange: failure armed with NO scope.
        failNext({
            operation: 'createSubscription',
            errorCode: 'TIMEOUT',
            errorMessage: 'matches anyone'
        });

        // Act + Assert: an arbitrary owner consumes it.
        await expect(
            applyTestControl('createSubscription', { customerId: 'cust-X' }, ok)
        ).rejects.toThrow('matches anyone');

        // Queue drained: the next call runs real.
        await expect(
            applyTestControl('createSubscription', { customerId: 'cust-X' }, ok)
        ).resolves.toBe('real-result');
    });

    it('(b2) an unscoped entry matches a call with no extractable scope', async () => {
        failNext({
            operation: 'createSubscription',
            errorCode: 'TIMEOUT',
            errorMessage: 'no-scope call'
        });

        // args without customerId → callScope undefined; unscoped entry still matches.
        await expect(applyTestControl('createSubscription', { foo: 'bar' }, ok)).rejects.toThrow(
            'no-scope call'
        );
    });

    it('(c) FIFO order is preserved within the same scope', async () => {
        // Arrange: two failures for the same owner, distinct messages.
        failNext({
            operation: 'createSubscription',
            errorCode: 'E1',
            errorMessage: 'first',
            scope: 'cust-A'
        });
        failNext({
            operation: 'createSubscription',
            errorCode: 'E2',
            errorMessage: 'second',
            scope: 'cust-A'
        });

        // Act + Assert: consumed first-in-first-out.
        await expect(
            applyTestControl('createSubscription', { customerId: 'cust-A' }, ok)
        ).rejects.toThrow('first');
        await expect(
            applyTestControl('createSubscription', { customerId: 'cust-A' }, ok)
        ).rejects.toThrow('second');
        // Third call: queue empty → real.
        await expect(
            applyTestControl('createSubscription', { customerId: 'cust-A' }, ok)
        ).resolves.toBe('real-result');
    });

    it('a scoped entry does not block an unscoped fallthrough for another scope', async () => {
        // Mixed queue: scoped-to-A first, unscoped second.
        failNext({
            operation: 'createSubscription',
            errorCode: 'E1',
            errorMessage: 'only-A',
            scope: 'cust-A'
        });
        failNext({
            operation: 'createSubscription',
            errorCode: 'E2',
            errorMessage: 'anyone'
        });

        // cust-B skips the scoped-A entry and consumes the unscoped one.
        await expect(
            applyTestControl('createSubscription', { customerId: 'cust-B' }, ok)
        ).rejects.toThrow('anyone');
        // cust-A still has its scoped entry waiting.
        await expect(
            applyTestControl('createSubscription', { customerId: 'cust-A' }, ok)
        ).rejects.toThrow('only-A');
    });
});

describe('qzpay-test-control — delayNext scope matching (SPEC-221)', () => {
    beforeEach(() => {
        process.env.HOSPEDA_QZPAY_TEST_CONTROL_ENABLED = 'true';
        resetTestControl();
    });

    afterEach(() => {
        resetTestControl();
        // See the note in the failNext block's afterEach: '', never undefined.
        process.env.HOSPEDA_QZPAY_TEST_CONTROL_ENABLED = '';
    });

    it('(d1) a scoped delay is consumed only by the matching scope', async () => {
        // Pair each delay with a same-scope failure so the recorded outcome
        // ('delayed-then-failed' vs plain 'failed') reveals whether the delay
        // actually fired — no brittle wall-clock timing assertions needed.
        delayNext('createSubscription', 1, 'cust-A');
        failNext({
            operation: 'createSubscription',
            errorCode: 'E',
            errorMessage: 'A',
            scope: 'cust-A'
        });
        failNext({
            operation: 'createSubscription',
            errorCode: 'E',
            errorMessage: 'B',
            scope: 'cust-B'
        });

        // cust-B does NOT consume the cust-A delay → outcome 'failed'.
        await expect(
            applyTestControl('createSubscription', { customerId: 'cust-B' }, ok)
        ).rejects.toThrow('B');
        // cust-A consumes its delay → outcome 'delayed-then-failed'.
        await expect(
            applyTestControl('createSubscription', { customerId: 'cust-A' }, ok)
        ).rejects.toThrow('A');

        const calls = getRecordedCalls('createSubscription');
        expect(calls[0]?.outcome).toBe('failed');
        expect(calls[1]?.outcome).toBe('delayed-then-failed');
    });

    it('(d2) an unscoped delay is consumed by any caller (backward-compat)', async () => {
        delayNext('createSubscription', 1);
        failNext({ operation: 'createSubscription', errorCode: 'E', errorMessage: 'x' });

        await expect(
            applyTestControl('createSubscription', { customerId: 'whoever' }, ok)
        ).rejects.toThrow('x');
        expect(getRecordedCalls('createSubscription')[0]?.outcome).toBe('delayed-then-failed');
        expect(getTestControlSnapshot().delayNextQueueLength).toBe(0);
    });

    it('(d3) a non-matching delay stays queued while the matching one is consumed', async () => {
        delayNext('createSubscription', 1, 'cust-A');
        delayNext('createSubscription', 1, 'cust-B');

        // cust-A consumes only its own delay; cust-B's remains queued.
        await applyTestControl('createSubscription', { customerId: 'cust-A' }, ok);
        expect(getTestControlSnapshot().delayNextQueueLength).toBe(1);

        // cust-B then consumes the remaining delay.
        await applyTestControl('createSubscription', { customerId: 'cust-B' }, ok);
        expect(getTestControlSnapshot().delayNextQueueLength).toBe(0);
    });
});
