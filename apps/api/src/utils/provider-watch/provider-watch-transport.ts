/**
 * The raw Mercado Pago transport of the watch battery, built from the app's environment
 * (HOS-1512). Shared by the cron job and the admin routes that read the provider account.
 *
 * @module utils/provider-watch/provider-watch-transport
 */
import { createWatchTransport, type WatchTransport } from '@repo/payments';
import { env } from '../env.js';

/**
 * Builds the transport with this environment's access token.
 *
 * @param args.signal - The run's cancellation signal, so a cancelled run stops sending
 * @returns The transport
 * @throws When the access token is not set
 */
export function buildWatchTransport(
    args: { readonly signal?: AbortSignal | undefined } = {}
): WatchTransport {
    const accessToken = env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) {
        throw new Error('HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN is not set: nothing to measure with');
    }
    return createWatchTransport({
        baseUrl: env.HOSPEDA_MERCADO_PAGO_API_BASE_URL,
        accessToken,
        timeoutMs: env.HOSPEDA_MERCADO_PAGO_TIMEOUT,
        signal: args.signal
    });
}
