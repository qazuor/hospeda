import { createLogger } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { CAPABILITY_METHODS, PaymentProviderError, PROVIDER_METHODS } from '@repo/payments';
import { z } from 'zod';

/** Sweep pacing budget. HOS-1737 keeps this longer than the webhook budget. */
export interface SweepProviderPacing {
    readonly minIntervalMs: number;
    readonly maxAttempts: number;
    readonly baseDelayMs: number;
    readonly maxDelayMs: number;
    readonly maxRunDelayMs: number;
}

/**
 * HOS-1737 gives the sweep its own provider rhythm. The webhook's
 * MERCADOPAGO_READ_RETRY_POLICY is short by design so its receiver can answer
 * promptly; the sweep has no caller response deadline but runs under its
 * 10-minute job limit. Only reads retry because writes are not idempotent. This
 * budget layers over the adapter retry (up to three HTTP requests per attempt).
 */
export const RECONCILIATION_SWEEP_PROVIDER_PACING: SweepProviderPacing = {
    minIntervalMs: 250,
    maxAttempts: 5,
    baseDelayMs: 2000,
    maxDelayMs: 16000,
    maxRunDelayMs: 240000
};

const PacingSchema = z.strictObject({
    minIntervalMs: z.number().int().nonnegative(),
    maxAttempts: z.number().int().min(1),
    baseDelayMs: z.number().int().nonnegative(),
    maxDelayMs: z.number().int().nonnegative(),
    maxRunDelayMs: z.number().int().nonnegative()
});

const logger = createLogger('billing-reconciliation-sweep');

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * Creates a provider decorator with per-run call spacing and retry limits.
 * Once the run retry-delay budget is exhausted, subsequent reads make one
 * attempt and propagate their error without retrying.
 */
export function createSweepPacedProvider(input: {
    readonly provider: PaymentProvider;
    readonly pacing: SweepProviderPacing;
    readonly sleep?: (ms: number) => Promise<void>;
    readonly now?: () => number;
}): PaymentProvider {
    const pacing = PacingSchema.parse(input.pacing);
    const sleep =
        input.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    const now = input.now ?? Date.now;
    const reads = new Set<string>(CAPABILITY_METHODS.read);
    const unpaced = new Set<string>(CAPABILITY_METHODS.notify);
    let nextSlotAt = 0;
    let totalRetryDelayMs = 0;
    let budgetExhausted = false;
    let budgetWarningLogged = false;
    const decorated: Record<string, unknown> = {
        capabilitySupport: input.provider.capabilitySupport
    };

    for (const method of PROVIDER_METHODS) {
        decorated[method] = async (methodInput: unknown) => {
            const call = async () =>
                Reflect.apply(input.provider[method], input.provider, [methodInput]);
            const spacedCall = async () => {
                if (!unpaced.has(method)) {
                    const start = Math.max(now(), nextSlotAt);
                    nextSlotAt = start + pacing.minIntervalMs;
                    const waitMs = start - now();
                    if (waitMs > 0) await sleep(waitMs);
                }
                return call();
            };
            if (!reads.has(method)) return spacedCall();

            for (let attempt = 1; ; attempt++) {
                try {
                    return await spacedCall();
                } catch (error) {
                    if (
                        !(error instanceof PaymentProviderError) ||
                        error.code !== 'UNAVAILABLE' ||
                        budgetExhausted ||
                        attempt >= pacing.maxAttempts
                    ) {
                        throw error;
                    }
                    const delayMs = Math.min(
                        pacing.maxDelayMs,
                        pacing.baseDelayMs * 2 ** (attempt - 1)
                    );
                    if (totalRetryDelayMs + delayMs > pacing.maxRunDelayMs) {
                        budgetExhausted = true;
                        if (!budgetWarningLogged) {
                            budgetWarningLogged = true;
                            logger.warn({ method }, 'Sweep provider retry delay budget exhausted');
                        }
                        throw error;
                    }
                    totalRetryDelayMs += delayMs;
                    logger.warn(
                        {
                            method,
                            attempt: attempt + 1,
                            delayMs,
                            error: errorMessage(error)
                        },
                        'Retrying sweep provider read'
                    );
                    await sleep(delayMs);
                }
            }
        };
    }

    // TYPE-WORKAROUND: PROVIDER_METHODS is checked against PaymentProvider through EveryMethodHasACapability.
    return decorated as unknown as PaymentProvider;
}
