/**
 * MercadoPago adapter stub for E2E billing tests (SPEC-143 T-143-05 revised).
 *
 * Replaces the real `QZPayMercadoPagoAdapter` produced by
 * `createMercadoPagoAdapter()` in `@repo/billing` with a deterministic,
 * in-memory stub that never talks to MP. Used by Workstream A (CI e2e flows)
 * per the SPEC-143 decision Q1: stub MP in CI, use real sandbox only in
 * Workstream B manual checklists.
 *
 * SHAPE NOTE: this stub mirrors the REAL adapter contract defined in
 * qzpay-core's `QZPayPaymentAdapter` interface (verified against
 * `/home/qazuor/projects/PACKAGES/qzpay/packages/core/src/adapters/payment.adapter.ts`).
 * Each sub-adapter (`customers`, `subscriptions`, `payments`, `checkout`,
 * `prices`, `webhooks`) exposes only the methods qzpay-core or hospeda code
 * actually invokes — no MP-raw operations (those are internal to the real
 * MP adapter, not callable through the QZPay contract).
 *
 * Distinction from {@link applyTestControl} (packages/billing/src/adapters/qzpay-test-control.ts):
 * - `qzpay-test-control` wraps the REAL adapter and injects failures into
 *   specific high-level operations. It needs a real MP sandbox to provide
 *   success-path responses. Used by Workstream B sandbox tests.
 * - This stub IS the adapter. No network. Used by Workstream A CI tests.
 *
 * Usage pattern in a test file:
 *
 * ```ts
 * import { createMpStubAdapter } from '../../helpers/mp-stub';
 * import { providerResponseFixtures } from '../../helpers/billing-fixtures';
 *
 * const mpStub = createMpStubAdapter();
 *
 * vi.mock('@repo/billing', async (importOriginal) => {
 *     const actual = await importOriginal<typeof import('@repo/billing')>();
 *     return { ...actual, createMercadoPagoAdapter: () => mpStub.adapter };
 * });
 *
 * beforeEach(() => mpStub.config.reset());
 *
 * it('annual checkout calls checkout.create', async () => {
 *     mpStub.config.setSuccess(
 *         'checkout.create',
 *         providerResponseFixtures.checkout({ id: 'chk_test_123', url: '...' })
 *     );
 *     // ... act ...
 *     expect(mpStub.config.getCalls('checkout.create')).toHaveLength(1);
 * });
 * ```
 *
 * @module test/e2e/helpers/mp-stub
 */

import type { QZPayMercadoPagoAdapter } from '@qazuor/qzpay-mercadopago';

// ---------------------------------------------------------------------------
// Public API surface
// ---------------------------------------------------------------------------

/**
 * Operations the stub knows how to intercept. Each maps to a dotted path
 * on the real `QZPayPaymentAdapter` (e.g. `checkout.create` →
 * `adapter.checkout.create(...)`). Set matches the qzpay-core contract
 * exactly; methods qzpay-core or hospeda code does not invoke are omitted.
 *
 * If a test invokes an operation not listed here, the stub throws a
 * descriptive error rather than silently returning `undefined`.
 */
export type MpStubOperation =
    // Checkout (one-time payments: annual subscription, addon purchase)
    | 'checkout.create'
    | 'checkout.retrieve'
    | 'checkout.expire'
    // Customers (provider-side customer records)
    | 'customers.create'
    | 'customers.retrieve'
    | 'customers.update'
    | 'customers.delete'
    // Payments (post-checkout, reconciliation, refund)
    | 'payments.create'
    | 'payments.retrieve'
    | 'payments.capture'
    | 'payments.cancel'
    | 'payments.refund'
    // Subscriptions (preapproval-style recurring)
    | 'subscriptions.create'
    | 'subscriptions.retrieve'
    | 'subscriptions.update'
    | 'subscriptions.cancel'
    | 'subscriptions.pause'
    | 'subscriptions.resume'
    // Prices (provider-side price catalog)
    | 'prices.create'
    | 'prices.retrieve'
    | 'prices.archive'
    | 'prices.createProduct'
    // Webhooks (signature + event parsing helpers)
    | 'webhooks.constructEvent'
    | 'webhooks.verifySignature';

/**
 * Response modes for a stubbed operation.
 *
 * - `success`: returns the configured `data` payload immediately.
 * - `error`: throws an Error with the configured HTTP `status` + optional `code`.
 *   The thrown error carries `status` and `code` properties for handlers
 *   that branch on those fields.
 * - `timeout`: never resolves within `delayMs` milliseconds. The caller's
 *   timeout config is expected to reject before then.
 * - `malformed`: returns `raw` as-is — useful to exercise downstream parsing
 *   code paths that expect a specific shape. The stub does NO validation.
 */
export type MpStubResponseMode =
    | { readonly kind: 'success'; readonly data: unknown }
    | {
          readonly kind: 'error';
          readonly status: number;
          readonly message: string;
          readonly code?: string;
      }
    | { readonly kind: 'timeout'; readonly delayMs: number }
    | { readonly kind: 'malformed'; readonly raw: unknown };

/**
 * Recorded invocation of a stubbed operation. Used for post-test assertions
 * (count, order, args inspection).
 */
export interface MpStubCall {
    readonly operation: MpStubOperation;
    /** Arguments the caller passed, in declaration order. */
    readonly args: readonly unknown[];
    /** Unix ms timestamp when the call was intercepted. */
    readonly timestamp: number;
    /** Result of the dispatch — useful when asserting error-path tests. */
    readonly outcome: 'success' | 'error' | 'timeout' | 'malformed' | 'unconfigured';
}

/**
 * Configuration surface for a stub instance. Exposes operation-level setters
 * plus introspection helpers.
 */
export interface MpStubConfig {
    /**
     * Set an explicit {@link MpStubResponseMode} for `op`. Subsequent calls
     * to `op` use this response until {@link MpStubConfig.reset} or a new
     * `setResponse` overwrites it.
     */
    setResponse(op: MpStubOperation, response: MpStubResponseMode): void;
    /** Convenience: `setResponse(op, { kind: 'success', data })`. */
    setSuccess(op: MpStubOperation, data: unknown): void;
    /** Convenience: `setResponse(op, { kind: 'error', status, message, code })`. */
    setError(op: MpStubOperation, status: number, message: string, code?: string): void;
    /** Convenience: `setResponse(op, { kind: 'timeout', delayMs })`. */
    setTimeout(op: MpStubOperation, delayMs: number): void;
    /** Convenience: `setResponse(op, { kind: 'malformed', raw })`. */
    setMalformed(op: MpStubOperation, raw: unknown): void;
    /**
     * Clear all configured responses AND the recorded call log. Call from
     * `beforeEach` to keep test isolation.
     */
    reset(): void;
    /**
     * Returns recorded calls in invocation order. Filter by operation when
     * provided.
     */
    getCalls(op?: MpStubOperation): readonly MpStubCall[];
}

/**
 * Result of {@link createMpStubAdapter}: the stub `adapter` ready to inject,
 * and the `config` handle the test uses to program responses.
 */
export interface CreateMpStubResult {
    /**
     * The stub adapter, cast to `QZPayMercadoPagoAdapter` for type-compatibility
     * with `createMercadoPagoAdapter`'s real return type.
     *
     * IMPORTANT: only the operations listed in {@link MpStubOperation} are
     * implemented. Calls to any other adapter method throw at runtime —
     * this is intentional so tests fail loud rather than silently pass on
     * missing stubs.
     */
    readonly adapter: QZPayMercadoPagoAdapter;
    readonly config: MpStubConfig;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Create a fresh stub adapter + config pair.
 *
 * Each call returns an isolated instance — useful for parallel test files
 * to avoid cross-contamination of recorded calls.
 *
 * @returns `{ adapter, config }`
 */
export function createMpStubAdapter(): CreateMpStubResult {
    const responses = new Map<MpStubOperation, MpStubResponseMode>();
    const calls: MpStubCall[] = [];

    /**
     * Internal dispatcher: looks up the configured response for `op`,
     * records the call, then resolves or rejects accordingly.
     */
    async function dispatch<T>(op: MpStubOperation, args: readonly unknown[]): Promise<T> {
        const mode = responses.get(op);

        if (mode === undefined) {
            calls.push({
                operation: op,
                args: [...args],
                timestamp: Date.now(),
                outcome: 'unconfigured'
            });
            throw new MpStubUnconfiguredError(op);
        }

        switch (mode.kind) {
            case 'success': {
                calls.push({
                    operation: op,
                    args: [...args],
                    timestamp: Date.now(),
                    outcome: 'success'
                });
                return mode.data as T;
            }
            case 'error': {
                calls.push({
                    operation: op,
                    args: [...args],
                    timestamp: Date.now(),
                    outcome: 'error'
                });
                throw buildHttpLikeError(mode.status, mode.message, mode.code);
            }
            case 'timeout': {
                calls.push({
                    operation: op,
                    args: [...args],
                    timestamp: Date.now(),
                    outcome: 'timeout'
                });
                await new Promise<void>((resolve) => {
                    const timer = setTimeout(() => resolve(), mode.delayMs);
                    if (typeof timer === 'object' && timer && 'unref' in timer) {
                        (timer as { unref: () => void }).unref();
                    }
                });
                throw buildHttpLikeError(
                    408,
                    `Stub timeout after ${mode.delayMs}ms on ${op}`,
                    'TIMEOUT'
                );
            }
            case 'malformed': {
                calls.push({
                    operation: op,
                    args: [...args],
                    timestamp: Date.now(),
                    outcome: 'malformed'
                });
                return mode.raw as T;
            }
        }
    }

    /**
     * Synchronous dispatcher for webhooks.verifySignature which returns a
     * boolean (not a Promise). The real adapter signature is synchronous so
     * the stub must match.
     */
    function dispatchSync<T>(op: MpStubOperation, args: readonly unknown[]): T {
        const mode = responses.get(op);

        if (mode === undefined) {
            calls.push({
                operation: op,
                args: [...args],
                timestamp: Date.now(),
                outcome: 'unconfigured'
            });
            throw new MpStubUnconfiguredError(op);
        }

        if (mode.kind === 'success') {
            calls.push({
                operation: op,
                args: [...args],
                timestamp: Date.now(),
                outcome: 'success'
            });
            return mode.data as T;
        }

        if (mode.kind === 'error') {
            calls.push({
                operation: op,
                args: [...args],
                timestamp: Date.now(),
                outcome: 'error'
            });
            throw buildHttpLikeError(mode.status, mode.message, mode.code);
        }

        if (mode.kind === 'malformed') {
            calls.push({
                operation: op,
                args: [...args],
                timestamp: Date.now(),
                outcome: 'malformed'
            });
            return mode.raw as T;
        }

        // `timeout` mode is not supported for synchronous methods; treat as
        // an unconfigured-style failure so the test fails loudly.
        throw new Error(
            `mp-stub: 'timeout' mode is not supported for synchronous operation "${op}"`
        );
    }

    const config: MpStubConfig = {
        setResponse(op, response) {
            responses.set(op, response);
        },
        setSuccess(op, data) {
            responses.set(op, { kind: 'success', data });
        },
        setError(op, status, message, code) {
            responses.set(op, { kind: 'error', status, message, code });
        },
        setTimeout(op, delayMs) {
            responses.set(op, { kind: 'timeout', delayMs });
        },
        setMalformed(op, raw) {
            responses.set(op, { kind: 'malformed', raw });
        },
        reset() {
            responses.clear();
            calls.length = 0;
        },
        getCalls(op) {
            if (op === undefined) return [...calls];
            return calls.filter((c) => c.operation === op);
        }
    };

    // Build the duck-typed adapter shape. Each method delegates to dispatch.
    // We satisfy QZPayMercadoPagoAdapter via `unknown as` because the real
    // class has private fields we do not implement; the public method shape
    // is what qzpay-core actually invokes.
    const adapter = {
        provider: 'mercadopago' as const,
        checkout: {
            create: (input: unknown) => dispatch('checkout.create', [input]),
            retrieve: (id: string) => dispatch('checkout.retrieve', [id]),
            expire: (id: string) => dispatch('checkout.expire', [id])
        },
        customers: {
            create: (input: unknown) => dispatch('customers.create', [input]),
            retrieve: (id: string) => dispatch('customers.retrieve', [id]),
            update: (id: string, partial: unknown) => dispatch('customers.update', [id, partial]),
            delete: (id: string) => dispatch('customers.delete', [id])
        },
        payments: {
            create: (providerCustomerId: string, input: unknown) =>
                dispatch('payments.create', [providerCustomerId, input]),
            retrieve: (id: string) => dispatch('payments.retrieve', [id]),
            capture: (id: string) => dispatch('payments.capture', [id]),
            cancel: (id: string) => dispatch('payments.cancel', [id]),
            refund: (input: unknown, providerPaymentId: string) =>
                dispatch('payments.refund', [input, providerPaymentId])
        },
        subscriptions: {
            create: (input: unknown) => dispatch('subscriptions.create', [input]),
            retrieve: (id: string) => dispatch('subscriptions.retrieve', [id]),
            update: (id: string, input: unknown) => dispatch('subscriptions.update', [id, input]),
            cancel: (id: string, cancelAtPeriodEnd: boolean) =>
                dispatch('subscriptions.cancel', [id, cancelAtPeriodEnd]),
            pause: (id: string) => dispatch('subscriptions.pause', [id]),
            resume: (id: string) => dispatch('subscriptions.resume', [id])
        },
        prices: {
            create: (input: unknown, providerProductId: string) =>
                dispatch('prices.create', [input, providerProductId]),
            archive: (id: string) => dispatch('prices.archive', [id]),
            retrieve: (id: string) => dispatch('prices.retrieve', [id]),
            createProduct: (name: string, description?: string) =>
                dispatch('prices.createProduct', [name, description])
        },
        webhooks: {
            // `constructEvent` and `verifySignature` are SYNCHRONOUS in the
            // real adapter contract. Use dispatchSync to match the signature.
            constructEvent: (payload: string | Buffer, signature: string) =>
                dispatchSync('webhooks.constructEvent', [payload, signature]),
            verifySignature: (payload: string | Buffer, signature: string) =>
                dispatchSync<boolean>('webhooks.verifySignature', [payload, signature])
        }
    };

    return {
        adapter: adapter as unknown as QZPayMercadoPagoAdapter,
        config
    };
}

// ---------------------------------------------------------------------------
// Error shapes
// ---------------------------------------------------------------------------

/**
 * Thrown when a test invokes an operation it never configured. Surfaces
 * with the operation name in the message so failures are immediately
 * actionable.
 */
export class MpStubUnconfiguredError extends Error {
    public readonly operation: MpStubOperation;
    public readonly code = 'MP_STUB_UNCONFIGURED';

    constructor(operation: MpStubOperation) {
        super(
            `mp-stub: no response configured for "${operation}". Call config.setSuccess / setError / setTimeout / setMalformed before invoking.`
        );
        this.name = 'MpStubUnconfiguredError';
        this.operation = operation;
    }
}

/**
 * Error shape mirroring what `@qazuor/qzpay-mercadopago` throws on a non-2xx
 * HTTP response. Hospeda code branches on `status` and `code`, so the stub
 * must carry them as own properties.
 */
interface HttpLikeError extends Error {
    status: number;
    code?: string;
}

function buildHttpLikeError(status: number, message: string, code?: string): HttpLikeError {
    const err = new Error(message) as HttpLikeError;
    err.name = 'MpStubHttpError';
    err.status = status;
    if (code !== undefined) {
        err.code = code;
    }
    return err;
}
