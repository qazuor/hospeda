import { GOVERNOR_WINDOW_MS, type GovernorMode, ProviderTrafficGovernor } from '@repo/payments';
import { env } from './env';
import { apiLogger } from './logger';
import { createMercadoPagoRedisCoolDownStore } from './mp-cooldown-redis-store';

let processGovernor: ProviderTrafficGovernor | undefined;
let initialized = false;

/** Build the process-wide MP governor.
 * Emits at most one Sentry capture per capability per fixed 60 s window (`floor(now / GOVERNOR_WINDOW_MS)`).
 */
export function createMercadoPagoTrafficGovernor(args: {
    readonly mode: 'off' | GovernorMode;
    readonly now?: () => number;
}): ProviderTrafficGovernor | undefined {
    if (args.mode === 'off') return undefined;
    const capturedAt = new Map<string, number>();
    const now = args.now ?? Date.now;
    const governor = new ProviderTrafficGovernor({
        mode: args.mode,
        ...(args.mode === 'enforce' && env.HOSPEDA_REDIS_URL
            ? {
                  coolDownStore: createMercadoPagoRedisCoolDownStore({
                      redisUrl: env.HOSPEDA_REDIS_URL
                  })
              }
            : {}),
        now,
        onWindow: (window) => apiLogger.info({ message: 'mp_traffic_window', ...window }),
        onInteractiveRateLimited: (info) => {
            const window = Math.floor(now() / GOVERNOR_WINDOW_MS);
            const capture = capturedAt.get(info.capability) !== window;
            capturedAt.set(info.capability, window);
            apiLogger.warn(
                { message: '[mp-governor] interactive Mercado Pago request rate limited', ...info },
                undefined,
                capture ? { capture: true } : undefined
            );
        },
        onError: (error) =>
            apiLogger.warn({ message: '[mp-governor] bookkeeping failed', error: String(error) })
    });
    governor.start();
    return governor;
}

/** Return the single process-wide governor for the configured environment mode. */
export function getMercadoPagoTrafficGovernor(
    args: { readonly mode?: 'off' | GovernorMode } = {}
): ProviderTrafficGovernor | undefined {
    if (initialized) return processGovernor;
    initialized = true;
    processGovernor = createMercadoPagoTrafficGovernor({
        mode: args.mode ?? env.HOSPEDA_MERCADO_PAGO_GOVERNOR_MODE
    });
    return processGovernor;
}

/** Tell whether the process governor owns retry behavior. */
export function isMercadoPagoGovernorEnforcing(): boolean {
    return getMercadoPagoTrafficGovernor()?.mode === 'enforce';
}

/**
 * The webhook's rate-limit deferral port (HOS-1999 AC-29): present only when the
 * governor enforces, so `off` and `observe` keep a RATE_LIMITED read as `FAILED`.
 */
export function mercadoPagoRateLimitDeferral(args: {
    readonly governor: ProviderTrafficGovernor | undefined;
}): { readonly coolDownRemainingMs: () => number } | undefined {
    const governor = args.governor;
    if (governor?.mode !== 'enforce') return undefined;
    return { coolDownRemainingMs: () => governor.coolDownRemainingMs() };
}

/** Stop the process governor and boundedly close its Redis client without throwing. */
export async function shutdownMercadoPagoTrafficGovernor(): Promise<void> {
    try {
        await processGovernor?.shutdown();
    } catch {
        // Shutdown must continue even if governor cleanup fails.
    } finally {
        processGovernor = undefined;
        initialized = false;
    }
}
