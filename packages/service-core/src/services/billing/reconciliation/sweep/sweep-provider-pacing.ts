import type { PaymentProvider } from '@repo/payments';

/** Sweep pacing budget. HOS-1737 keeps this longer than the webhook budget. */
export interface SweepProviderPacing {
    readonly minIntervalMs: number;
    readonly maxAttempts: number;
    readonly baseDelayMs: number;
    readonly maxDelayMs: number;
    readonly maxRunDelayMs: number;
}

/**
 * HOS-1737 gives the sweep its own provider rhythm: webhook retries are short
 * by design to return to Mercado Pago promptly, while the sweep has a 10-minute
 * job limit. Only reads retry because writes are not idempotent. This budget
 * layers over the adapter retry (up to three HTTP requests per decorator attempt).
 */
export const RECONCILIATION_SWEEP_PROVIDER_PACING: SweepProviderPacing = {
    minIntervalMs: 250,
    maxAttempts: 5,
    baseDelayMs: 2000,
    maxDelayMs: 16000,
    maxRunDelayMs: 240000
};

/** Creates a per-run paced provider decorator for HOS-1737. */
export function createSweepPacedProvider(input: {
    readonly provider: PaymentProvider;
    readonly pacing: SweepProviderPacing;
    readonly sleep?: (ms: number) => Promise<void>;
    readonly now?: () => number;
}): PaymentProvider {
    return input.provider;
}
