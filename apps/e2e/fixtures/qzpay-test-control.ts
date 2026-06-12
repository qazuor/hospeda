/**
 * QZPay test-control fixture (SPEC-092 T-036).
 *
 * Wraps the test-only HTTP endpoint exposed by the API at
 * `/api/v1/test/qzpay-control` (mounted only when both
 * `NODE_ENV !== 'production'` and `HOSPEDA_QZPAY_TEST_CONTROL_ENABLED === 'true'`).
 *
 * Used by E2E tests that need deterministic failure injection into the
 * QZPay/MercadoPago adapter — failures the real sandbox cannot produce
 * on demand: HOST-07c (timeout), HOST-07d (post-trial DB write failure),
 * RES-01 (api caída during checkout), RES-04 (webhook duplicate).
 *
 * @example
 * ```ts
 * await qzpayControl.reset();
 * await qzpayControl.failNext({
 *     operation: 'startTrial',
 *     errorCode: 'TIMEOUT',
 *     errorMessage: 'QZPay startTrial exceeded 8s timeout'
 * });
 *
 * // Run the user action that should hit startTrial
 * await page.click('[data-testid="publicar"]');
 *
 * const calls = await qzpayControl.getRecordedCalls('startTrial');
 * expect(calls).toHaveLength(1);
 * expect(calls[0].outcome).toBe('failed');
 * ```
 */

const DEFAULT_API_BASE_URL = 'http://localhost:3001';

export type ControllableOperation =
    | 'startTrial'
    | 'cancelTrial'
    | 'createPaymentPreference'
    | 'capturePayment'
    | 'refundPayment'
    | 'cancelSubscription'
    | 'updateSubscription';

export interface RecordedCall {
    readonly operation: ControllableOperation;
    readonly args: unknown;
    readonly timestamp: number;
    readonly outcome: 'ok' | 'failed' | 'delayed-then-failed';
}

export interface QZPayTestControl {
    readonly failNext: (options: {
        readonly operation: ControllableOperation;
        readonly errorCode: string;
        readonly errorMessage: string;
        readonly delayMs?: number;
    }) => Promise<void>;
    readonly delayNext: (operation: ControllableOperation, ms: number) => Promise<void>;
    readonly getRecordedCalls: (
        operation?: ControllableOperation
    ) => Promise<ReadonlyArray<RecordedCall>>;
    readonly reset: () => Promise<void>;
    readonly snapshot: () => Promise<{
        readonly enabled: boolean;
        readonly failNextQueueLength: number;
        readonly delayNextQueueLength: number;
        readonly recordedCallsLength: number;
    }>;
}

/**
 * Builds a control client bound to the given API base URL.
 *
 * Throws on first method call when the test-control endpoint is not
 * mounted (response 404). This protects against running tests that
 * silently expect failure injection but receive a normal adapter
 * response because the env gate wasn't set.
 */
export function createQZPayTestControl(baseUrl: string = DEFAULT_API_BASE_URL): QZPayTestControl {
    const endpoint = `${baseUrl}/api/v1/test/qzpay-control`;

    async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
        const response = await fetch(`${endpoint}${path}`, {
            method,
            headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
            body: body !== undefined ? JSON.stringify(body) : undefined
        });
        if (response.status === 404) {
            throw new Error(
                `qzpay-test-control endpoint not mounted (${endpoint}${path}). Set HOSPEDA_QZPAY_TEST_CONTROL_ENABLED=true on the API process.`
            );
        }
        if (!response.ok) {
            throw new Error(
                `qzpay-test-control ${method} ${path} failed: ${response.status} ${response.statusText}`
            );
        }
        // The API wraps every 2xx body in a ResponseFactory envelope
        // ({ success, data, metadata }). The route handlers return raw
        // `c.json({ calls })` / `c.json({ ok })`, but the global response
        // middleware re-wraps them, so callers must read the inner `data`.
        const json = (await response.json()) as { success?: boolean; data?: unknown };
        if (json !== null && typeof json === 'object' && 'success' in json && 'data' in json) {
            return json.data as T;
        }
        return json as T;
    }

    return {
        failNext: async (options) => {
            await call<{ ok: boolean }>('POST', '/fail-next', options);
        },
        delayNext: async (operation, ms) => {
            await call<{ ok: boolean }>('POST', '/delay-next', { operation, ms });
        },
        getRecordedCalls: async (operation) => {
            const data = await call<{ calls: ReadonlyArray<RecordedCall> }>(
                'GET',
                operation
                    ? `/recorded-calls?operation=${encodeURIComponent(operation)}`
                    : '/recorded-calls'
            );
            return data.calls;
        },
        reset: async () => {
            await call<{ ok: boolean }>('POST', '/reset');
        },
        snapshot: async () => {
            return call<{
                enabled: boolean;
                failNextQueueLength: number;
                delayNextQueueLength: number;
                recordedCallsLength: number;
            }>('GET', '/state');
        }
    };
}
