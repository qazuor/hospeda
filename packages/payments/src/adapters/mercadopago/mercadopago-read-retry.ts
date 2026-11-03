import { PaymentProviderError } from '../../provider/errors';
import type { TrafficClass } from '../../provider/traffic-context';
import { GOVERNOR_INTERACTIVE_MAX_WAIT_MS } from '../../provider/traffic-governor';

/** Retry policy for read-only Mercado Pago requests. */
export interface MercadoPagoReadRetryPolicy {
    readonly maxAttempts: number;
    readonly baseDelayMs: number;
    readonly maxDelayMs: number;
    readonly maxTotalDelayMs: number;
}

/**
 * Default read retry budget for HOS-1737/HOS-1740. Only GET is retried because
 * provider writes are not idempotent by contract. The total delay is bounded so
 * a webhook receiver cannot wait indefinitely before returning to Mercado Pago.
 */
export const MERCADOPAGO_READ_RETRY_POLICY: MercadoPagoReadRetryPolicy = {
    maxAttempts: 3,
    baseDelayMs: 500,
    maxDelayMs: 2000,
    maxTotalDelayMs: 4000
};

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

/**
 * Parses a `Retry-After` header value (delta-seconds or HTTP date) into milliseconds.
 * An HTTP date is measured against the injected clock, so the result can be negative
 * when the date is already past; callers clamp. Returns `undefined` when absent or malformed.
 * Shared by the read retry loop and the transient-error classifier (HOS-1976).
 */
export function parseRetryAfterMs(args: {
    readonly value: string | null;
    readonly now: () => Date;
}): number | undefined {
    if (args.value === null) return undefined;
    const trimmed = args.value.trim();
    if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
    const instant = Date.parse(trimmed);
    return Number.isNaN(instant) ? undefined : instant - args.now().getTime();
}

function retryAfterMs(response: Response, now: () => Date): number | undefined {
    return parseRetryAfterMs({ value: response.headers.get('Retry-After'), now });
}

async function discardBody(response: Response): Promise<void> {
    try {
        await response.body?.cancel();
    } catch {
        // The response is already being discarded before another attempt.
    }
}

/** Executes one attempt for writes and bounded, deterministic retries for transient GET failures. */
export async function sendWithReadRetry(args: {
    readonly method: 'GET' | 'POST' | 'PUT';
    readonly attempt: (args: { readonly maxWaitMs?: number }) => Promise<Response>;
    readonly retryOwnership?: 'legacy' | 'governor';
    readonly trafficClass?: TrafficClass;
    readonly random?: () => number;
    readonly policy?: MercadoPagoReadRetryPolicy;
    readonly sleep?: (ms: number) => Promise<void>;
    readonly now?: () => Date;
}): Promise<Response> {
    const policy = args.policy ?? MERCADOPAGO_READ_RETRY_POLICY;
    const sleep =
        args.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    const now = args.now ?? (() => new Date());
    if (args.method !== 'GET') return args.attempt({});

    let totalDelayMs = 0;
    const startedAt = args.retryOwnership === 'governor' ? now().getTime() : 0;
    for (let attemptNumber = 1; ; attemptNumber++) {
        let response: Response | undefined;
        let failure: unknown;
        try {
            const remaining = Math.max(0, policy.maxTotalDelayMs - (now().getTime() - startedAt));
            response = await args.attempt(
                args.retryOwnership === 'governor' && args.trafficClass !== 'background'
                    ? { maxWaitMs: Math.min(GOVERNOR_INTERACTIVE_MAX_WAIT_MS, remaining) }
                    : {}
            );
        } catch (error) {
            if (
                args.retryOwnership === 'governor' &&
                error instanceof PaymentProviderError &&
                error.governorRejected
            )
                throw error;
            if (
                args.retryOwnership === 'governor' &&
                args.trafficClass !== 'background' &&
                now().getTime() - startedAt >= policy.maxTotalDelayMs
            )
                throw error;
            if (!(error instanceof PaymentProviderError) || error.code !== 'UNAVAILABLE')
                throw error;
            failure = error;
        }

        const retryable =
            failure !== undefined ||
            (response !== undefined && RETRYABLE_STATUSES.has(response.status));
        if (!retryable || attemptNumber >= policy.maxAttempts) {
            if (failure !== undefined) throw failure;
            if (response === undefined) throw new Error('Expected a Mercado Pago response');
            return response;
        }

        if (args.retryOwnership === 'governor') {
            const elapsed = now().getTime() - startedAt;
            if (args.trafficClass !== 'background' && elapsed >= policy.maxTotalDelayMs) {
                if (failure !== undefined) throw failure;
                if (!response) throw new Error('Expected a Mercado Pago response');
                return response;
            }
            const rateLimited = response?.status === 429;
            const requested = response
                ? (retryAfterMs(response, now) ?? policy.baseDelayMs * 2 ** (attemptNumber - 1))
                : policy.baseDelayMs * 2 ** (attemptNumber - 1);
            const jitter = args.random ?? Math.random;
            const delayMs = rateLimited
                ? 0
                : Math.min(
                      policy.maxDelayMs,
                      response?.headers.has('Retry-After')
                          ? Math.max(0, requested)
                          : requested * (0.5 + 0.5 * jitter())
                  );
            if (args.trafficClass !== 'background' && elapsed + delayMs > policy.maxTotalDelayMs) {
                if (failure !== undefined) throw failure;
                if (!response) throw new Error('Expected a Mercado Pago response');
                return response;
            }
            if (response) await discardBody(response);
            if (delayMs > 0) await sleep(delayMs);
            continue;
        }

        const requestedDelay = response
            ? (retryAfterMs(response, now) ?? policy.baseDelayMs * 2 ** (attemptNumber - 1))
            : policy.baseDelayMs * 2 ** (attemptNumber - 1);
        const delayMs = Math.min(policy.maxDelayMs, Math.max(0, requestedDelay));
        if (totalDelayMs + delayMs > policy.maxTotalDelayMs) {
            if (failure !== undefined) throw failure;
            if (response === undefined) throw new Error('Expected a Mercado Pago response');
            return response;
        }
        totalDelayMs += delayMs;
        if (response !== undefined) await discardBody(response);
        await sleep(delayMs);
    }
}
