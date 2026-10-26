import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import type { FakePaymentProvider } from '@repo/payments/fake';
import { type FakeProviderServer, startFakeProviderServer } from '@repo/payments/fake-server';
import type { AdjustableClock } from '@repo/test-clock';
import { removeE2eClockFile } from './clock-file-cleanup.ts';

// Keep this endpoint aligned with the API webServer env in playwright.config.ts.
/** Default HTTP URL for the local fake payment provider. */
export const E2E_FAKE_PROVIDER_URL = 'http://127.0.0.1:18090';
/** Fixed local port used by specs that exercise the fake payment provider. */
export const E2E_FAKE_PROVIDER_PORT = 18090;
/**
 * Shared webhook secret used by the built API and fake Mercado Pago deliveries.
 * `||`, not `??`: CI may export the variable as an empty string.
 */
export const E2E_WEBHOOK_SECRET =
    process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET || 'e2e-webhook-secret';
/** API endpoint receiving fake Mercado Pago notifications. */
export const E2E_RECEIVER_PATH = '/api/v1/webhooks/mercadopago';
/** API clock file written by the fake provider server. */
export const E2E_FAKE_PROVIDER_CLOCK_FILE = path.resolve(
    fileURLToPath(new URL('.', import.meta.url)),
    '../test-results/fake-provider-clock.json'
);

/** Start the fake provider server used by built API E2E specs. */
export async function startE2eFakeProvider(options: {
    readonly provider: FakePaymentProvider;
    readonly clock: AdjustableClock;
}): Promise<FakeProviderServer> {
    const startedAt = Date.now();
    let server: FakeProviderServer;
    while (true) {
        try {
            server = await startFakeProviderServer({
                provider: options.provider,
                clock: options.clock,
                host: '127.0.0.1',
                port: E2E_FAKE_PROVIDER_PORT,
                clockFile: E2E_FAKE_PROVIDER_CLOCK_FILE
            });
            break;
        } catch (error) {
            const code = (error as NodeJS.ErrnoException).code;
            if (code !== 'EADDRINUSE') throw error;
            if (Date.now() - startedAt >= 120_000) {
                throw new Error(
                    'Timed out waiting 120 seconds for port 18090; another spec may still own it.',
                    { cause: error }
                );
            }
            await delay(500);
        }
    }
    return {
        get url() {
            return server.url;
        },
        get port() {
            return server.port;
        },
        get provider() {
            return server.provider;
        },
        useProvider(args) {
            server.useProvider(args);
        },
        now() {
            return server.now();
        },
        advanceClock(args) {
            return server.advanceClock(args);
        },
        setClock(args) {
            return server.setClock(args);
        },
        requests() {
            return server.requests();
        },
        deliverDue(args) {
            return server.deliverDue(args);
        },
        mercadoPagoDeliveries(args) {
            return server.mercadoPagoDeliveries(args);
        },
        deliverDueAsMercadoPago(args) {
            return server.deliverDueAsMercadoPago(args);
        },
        async close() {
            try {
                await server.close();
            } finally {
                removeE2eClockFile({ path: E2E_FAKE_PROVIDER_CLOCK_FILE });
            }
        }
    };
}
