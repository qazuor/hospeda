/**
 * MercadoPago adapter stub for E2E billing tests (SPEC-143 T-143-05).
 *
 * Replaces the real `QZPayMercadoPagoAdapter` produced by
 * `createMercadoPagoAdapter()` in `@repo/billing` with a deterministic,
 * in-memory stub that never talks to MP. Used by Workstream A (CI e2e flows)
 * per the SPEC-143 decision Q1: stub MP in CI, use real sandbox only in
 * Workstream B manual checklists.
 *
 * Distinction from {@link applyTestControl} (packages/billing/src/adapters/qzpay-test-control.ts):
 * - `qzpay-test-control` wraps the REAL adapter and injects failures into
 *   specific operations. It needs a real MP sandbox to provide success-path
 *   responses. Used by Workstream B sandbox tests.
 * - This stub IS the adapter. No network. Used by Workstream A CI tests.
 *
 * Usage pattern in a test file:
 *
 * ```ts
 * import { createMpStubAdapter } from '../../helpers/mp-stub';
 *
 * vi.mock('@repo/billing', async (importOriginal) => {
 *     const actual = await importOriginal<typeof import('@repo/billing')>();
 *     return { ...actual, createMercadoPagoAdapter: () => mpStub.adapter };
 * });
 *
 * const mpStub = createMpStubAdapter();
 *
 * beforeEach(() => {
 *     mpStub.config.reset();
 * });
 *
 * it('annual checkout creates preference', async () => {
 *     mpStub.config.setSuccess('preferences.create', {
 *         id: 'pref_test_123',
 *         init_point: 'https://stub.example/checkout/pref_test_123'
 *     });
 *
 *     // ... act ...
 *
 *     const calls = mpStub.config.getCalls('preferences.create');
 *     expect(calls).toHaveLength(1);
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
 * on the real `QZPayMercadoPagoAdapter` (e.g. `preferences.create` →
 * `adapter.preferences.create(...)`).
 *
 * If a test invokes an operation not listed here, the stub throws a
 * descriptive error rather than silently returning `undefined`.
 */
export type MpStubOperation =
    // Checkout preference (one-time payments: annual subscription, addon purchase)
    | 'preferences.create'
    | 'preferences.get'
    // Preapproval (recurring subscriptions: monthly subscription via MP preapproval)
    | 'preapproval.create'
    | 'preapproval.get'
    | 'preapproval.update'
    | 'preapproval.cancel'
    // Payments (post-checkout, used by webhook handlers and reconciliation)
    | 'payments.get'
    | 'payments.list'
    | 'payments.search'
    | 'payments.refund'
    | 'payments.create'
    | 'payments.capture'
    // Customers (MP-side customer records; distinct from billing_customers)
    | 'customers.create'
    | 'customers.get'
    | 'customers.update'
    | 'customers.search'
    // Subscriptions (direct adapter calls from webhook subscription-logic.ts)
    | 'subscriptions.update';

/**
 * Response modes for a stubbed operation.
 *
 * - `success`: returns the configured `data` payload immediately.
 * - `error`: throws an Error with the configured HTTP `status` + optional `code`.
 *   The thrown error carries `status` and `code` properties for handlers
 *   that branch on those fields.
 * - `timeout`: never resolves within `delayMs` milliseconds. The caller's
 *   timeout config (default 5s via {@link MERCADO_PAGO_DEFAULT_TIMEOUT_MS})
 *   is expected to reject before then.
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
     * actually implemented. Calls to any other adapter method throw at
     * runtime — this is intentional so tests fail loud rather than silently
     * pass on missing stubs.
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
                    // Allow vitest's fake timers to advance without leaking handles.
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
    // interface ships from a versioned external package and we only need to
    // honor the methods invoked by Hospeda code under test.
    const adapter = {
        preferences: {
            create: (input: unknown) => dispatch('preferences.create', [input]),
            get: (id: string) => dispatch('preferences.get', [id])
        },
        preapproval: {
            create: (input: unknown) => dispatch('preapproval.create', [input]),
            get: (id: string) => dispatch('preapproval.get', [id]),
            update: (id: string, data: unknown) => dispatch('preapproval.update', [id, data]),
            cancel: (id: string) => dispatch('preapproval.cancel', [id])
        },
        payments: {
            create: (input: unknown) => dispatch('payments.create', [input]),
            get: (id: string) => dispatch('payments.get', [id]),
            list: (filters: unknown) => dispatch('payments.list', [filters]),
            search: (filters: unknown) => dispatch('payments.search', [filters]),
            refund: (id: string, data?: unknown) => dispatch('payments.refund', [id, data]),
            capture: (id: string, data?: unknown) => dispatch('payments.capture', [id, data])
        },
        customers: {
            create: (input: unknown) => dispatch('customers.create', [input]),
            get: (id: string) => dispatch('customers.get', [id]),
            update: (id: string, data: unknown) => dispatch('customers.update', [id, data]),
            search: (filters: unknown) => dispatch('customers.search', [filters])
        },
        subscriptions: {
            update: (id: string, data: unknown) => dispatch('subscriptions.update', [id, data])
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
