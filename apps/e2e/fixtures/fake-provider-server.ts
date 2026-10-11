import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FakePaymentProvider } from '@repo/payments/fake';
import { startFakeProviderServer } from '@repo/payments/fake-server';
import type { AdjustableClock } from '@repo/test-clock';

// Keep this endpoint aligned with the API webServer env in playwright.config.ts.
export const E2E_FAKE_PROVIDER_URL = 'http://127.0.0.1:18090';
export const E2E_FAKE_PROVIDER_PORT = 18090;
export const E2E_FAKE_PROVIDER_CLOCK_FILE = path.resolve(
    fileURLToPath(new URL('.', import.meta.url)),
    '../test-results/fake-provider-clock.json'
);

export async function startE2eFakeProvider(options: {
    readonly provider: FakePaymentProvider;
    readonly clock: AdjustableClock;
}) {
    return startFakeProviderServer({
        provider: options.provider,
        clock: options.clock,
        host: '127.0.0.1',
        port: E2E_FAKE_PROVIDER_PORT,
        clockFile: E2E_FAKE_PROVIDER_CLOCK_FILE
    });
}
