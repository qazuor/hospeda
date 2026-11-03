import { GOVERNOR_WINDOW_MS, type GovernorMode, ProviderTrafficGovernor } from '@repo/payments';
import { env } from './env';
import { apiLogger } from './logger';

let processGovernor: ProviderTrafficGovernor | undefined;
let initialized = false;

/** Build the process-wide MP governor, degrading enforce to observe in PR-1. */
export function createMercadoPagoTrafficGovernor(args: {
    readonly mode: 'off' | GovernorMode;
    readonly now?: () => number;
}): ProviderTrafficGovernor | undefined {
    if (args.mode === 'off') return undefined;
    if (args.mode === 'enforce') {
        apiLogger.warn({
            message: '[mp-governor] enforce is not available until HOS-1999 PR-3; running observe'
        });
    }
    const capturedAt = new Map<string, number>();
    const now = args.now ?? Date.now;
    const governor = new ProviderTrafficGovernor({
        mode: 'observe',
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
