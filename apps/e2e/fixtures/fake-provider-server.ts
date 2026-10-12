import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FakePaymentProvider } from '@repo/payments/fake';
import { type FakeProviderServer, startFakeProviderServer } from '@repo/payments/fake-server';
import type { AdjustableClock } from '@repo/test-clock';
import { removeE2eClockFile } from './clock-file-cleanup.ts';

// Keep this endpoint aligned with the API webServer env in playwright.config.ts.
export const E2E_FAKE_PROVIDER_URL = 'http://127.0.0.1:18090';
export const E2E_FAKE_PROVIDER_PORT = 18090;
export const E2E_FAKE_PROVIDER_CLOCK_FILE = path.resolve(
    fileURLToPath(new URL('.', import.meta.url)),
    '../test-results/fake-provider-clock.json'
);

/** Start the fake provider server used by built API E2E specs. */
export async function startE2eFakeProvider(options: {
    readonly provider: FakePaymentProvider;
    readonly clock: AdjustableClock;
}): Promise<FakeProviderServer> {
    const server = await startFakeProviderServer({
        provider: options.provider,
        clock: options.clock,
        host: '127.0.0.1',
        port: E2E_FAKE_PROVIDER_PORT,
        clockFile: E2E_FAKE_PROVIDER_CLOCK_FILE
    });
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
        async close() {
            await server.close();
            removeE2eClockFile({ path: E2E_FAKE_PROVIDER_CLOCK_FILE });
        }
    };
}
