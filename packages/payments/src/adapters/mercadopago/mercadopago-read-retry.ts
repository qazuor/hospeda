import { PaymentProviderError } from '../../provider/errors';

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
    readonly attempt: () => Promise<Response>;
    readonly policy?: MercadoPagoReadRetryPolicy;
    readonly sleep?: (ms: number) => Promise<void>;
    readonly now?: () => Date;
}): Promise<Response> {
    const policy = args.policy ?? MERCADOPAGO_READ_RETRY_POLICY;
    const sleep =
        args.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    const now = args.now ?? (() => new Date());
    if (args.method !== 'GET') return args.attempt();

    let totalDelayMs = 0;
    for (let attemptNumber = 1; ; attemptNumber++) {
        let response: Response | undefined;
        let failure: unknown;
        try {
            response = await args.attempt();
        } catch (error) {
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
