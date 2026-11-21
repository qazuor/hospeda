import { sql } from '@repo/db';
import { registerCaptureHook, unregisterCaptureHook } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { PaymentProviderError } from '@repo/payments';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { AmbiguousRefundAnswerError } from '../../../src/services/billing/refund/ambiguous-refund-answer.error.js';
import { confirmRefund } from '../../../src/services/billing/refund/confirm-refund.service.js';
import { retryRefundProviderCalls } from '../../../src/services/billing/refund/retry-refund-provider-calls.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { refundConfirmFixture, refundConfirmRows } from './support/refund-confirm-fixtures.js';

afterAll(closeServiceTestPool);
afterEach(unregisterCaptureHook);
const skip = !isServiceTestDbAvailable();

/** Errors the logger hands to the capture hook (the API turns them into Sentry events). */
function capturing(): unknown[] {
    const captured: unknown[] = [];
    registerCaptureHook((error) => captured.push(error));
    return captured;
}

function ambiguousReasons(captured: unknown[], refundId: string): string[] {
    return captured.flatMap((error) =>
        error instanceof AmbiguousRefundAnswerError && error.refundId === refundId
            ? [error.reason]
            : []
    );
}

/**
 * The provider whose first refund call lands but whose answer is lost. With `forgetsKey`, every
 * later call reaches the fake under a different reference: the provider no longer remembers the
 * idempotency key (the unmeasured case of matrix row EX-73), so a repost creates a new refund.
 */
function landedThenLost(provider: PaymentProvider, options: { readonly forgetsKey: boolean }) {
    const refund = vi.fn(provider.refund.bind(provider));
    let first = true;
    const wrapped = new Proxy(provider, {
        get(target, property, receiver) {
            if (property === 'refund')
                return async (input: Parameters<PaymentProvider['refund']>[0]) => {
                    if (first) {
                        first = false;
                        await refund(input);
                        throw new PaymentProviderError({
                            code: 'UNAVAILABLE',
                            capability: 'refund',
                            message: 'lost response'
                        });
                    }
                    return refund(
                        options.forgetsKey
                            ? { ...input, reference: `${input.reference}:forgotten` }
                            : input
                    );
                };
            return Reflect.get(target, property, receiver);
        }
    });
    return { wrapped, refund };
}

/** Confirms a refund whose single call landed at the provider but whose answer was lost. */
async function landedAndStuck(options: { readonly forgetsKey: boolean }) {
    const seeded = await refundConfirmFixture(10000, 4000);
    // Spend lie M13 (the first partial refund is refused) so the refund under test is accepted.
    await seeded.fixture.provider
        .refund({
            chargeId: seeded.charge.chargeId,
            amount: { amountMinor: 1, currency: 'ARS' },
            reference: `m13-${crypto.randomUUID()}`
        })
        .catch(() => undefined);
    const provider = landedThenLost(seeded.fixture.provider, options);
    const confirmed = await confirmRefund(
        { actor: seeded.actor, refundId: seeded.refundId },
        { clock: seeded.fixture.clock, provider: provider.wrapped }
    );
    expect(confirmed.outcome).toBe('AWAITING_PROVIDER_ANSWER');
    return { seeded, provider };
}

async function providerRefunds(seeded: Awaited<ReturnType<typeof refundConfirmFixture>>) {
    const read = await seeded.fixture.provider.readCharge({ chargeId: seeded.charge.chargeId });
    return read.snapshot.refunds;
}

describe('HOS-2516 the retry reads the charge before posting a lost call again', () => {
    it.skipIf(skip)(
        'a lost call that landed, with a provider that forgot the key, ends with ONE refund',
        async () => {
            // Arrange
            const { seeded, provider } = await landedAndStuck({ forgetsKey: true });
            expect(await providerRefunds(seeded)).toHaveLength(1);

            // Act
            const result = await retryRefundProviderCalls(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: provider.wrapped }
            );

            // Assert
            expect(result.calls.map(({ outcome }) => outcome)).toEqual(['FOUND_AT_PROVIDER']);
            expect(provider.refund).toHaveBeenCalledTimes(1);
            const refunds = await providerRefunds(seeded);
            expect(refunds).toHaveLength(1);
            const rows = await refundConfirmRows(seeded.refundId);
            expect(rows.calls.map((call) => call.providerRefundId)).toEqual([refunds[0]?.refundId]);
        }
    );

    it.skipIf(skip)(
        'several uncited refunds for the amount post nothing, alert, and keep the call unanswered',
        async () => {
            // Arrange: besides the landed call, an unrelated refund of the same amount exists.
            const { seeded, provider } = await landedAndStuck({ forgetsKey: true });
            await seeded.fixture.provider.refund({
                chargeId: seeded.charge.chargeId,
                amount: { amountMinor: 4000, currency: 'ARS' },
                reference: `unrelated-${crypto.randomUUID()}`
            });
            const captured = capturing();

            // Act
            const result = await retryRefundProviderCalls(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: provider.wrapped }
            );

            // Assert
            expect(result.calls.map(({ outcome }) => outcome)).toEqual([
                'AWAITING_PROVIDER_ANSWER'
            ]);
            expect(result.execution).toBeNull();
            expect(provider.refund).toHaveBeenCalledTimes(1);
            expect(await providerRefunds(seeded)).toHaveLength(2);
            expect(ambiguousReasons(captured, seeded.refundId)).toEqual([
                'SEVERAL_UNNAMED_PAYMENT_REFUNDS'
            ]);
            const rows = await refundConfirmRows(seeded.refundId);
            expect(rows.calls[0]?.providerRefundId).toBeNull();
        }
    );

    it.skipIf(skip)(
        'a second retry while the first runs is refused, with no false cited alert and one refund',
        async () => {
            // Arrange: the first retry stops inside its charge read until released.
            const { seeded, provider } = await landedAndStuck({ forgetsKey: false });
            let release: () => void = () => undefined;
            const gate = new Promise<void>((resolve) => {
                release = resolve;
            });
            let reached: () => void = () => undefined;
            const inRead = new Promise<void>((resolve) => {
                reached = resolve;
            });
            let blocked = false;
            const slow = new Proxy(provider.wrapped, {
                get(target, property, receiver) {
                    if (property === 'readCharge')
                        return async (input: Parameters<PaymentProvider['readCharge']>[0]) => {
                            if (!blocked) {
                                blocked = true;
                                reached();
                                await gate;
                            }
                            return target.readCharge(input);
                        };
                    return Reflect.get(target, property, receiver);
                }
            });
            const captured = capturing();
            const ports = { clock: seeded.fixture.clock, provider: slow };
            const request = { actor: seeded.actor, refundId: seeded.refundId };

            // Act
            const first = retryRefundProviderCalls(request, ports);
            await inRead;
            const second = await retryRefundProviderCalls(request, ports).then(
                () => null,
                (error: unknown) => error
            );
            release();
            const done = await first;

            // Assert
            expect(second).toMatchObject({
                code: 'ALREADY_EXISTS',
                reason: 'REFUND_RETRY_IN_PROGRESS'
            });
            expect(done.calls.map(({ outcome }) => outcome)).toEqual(['FOUND_AT_PROVIDER']);
            expect(ambiguousReasons(captured, seeded.refundId)).toEqual([]);
            expect(provider.refund).toHaveBeenCalledTimes(1);
            expect(await providerRefunds(seeded)).toHaveLength(1);
            // The lock was released: a later retry is judged on the refund, not refused as busy.
            const later = await retryRefundProviderCalls(request, ports).then(
                () => null,
                (error: unknown) => error
            );
            expect(later).not.toMatchObject({ reason: 'REFUND_RETRY_IN_PROGRESS' });
            // Checked across sessions: a pooled connection may re-enter its own advisory lock.
            const held = await getServiceTestDb().execute(sql`
                SELECT count(*)::int AS n FROM pg_locks
                WHERE locktype = 'advisory' AND granted AND objsubid = 1
                  AND ((classid::bigint << 32) | objid::bigint)
                      = hashtext(${'refund-retry:'} || ${seeded.refundId})::bigint`);
            expect(held.rows).toEqual([{ n: 0 }]);
        }
    );
});
