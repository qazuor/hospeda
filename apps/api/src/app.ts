import type { Clock } from '@repo/billing-verticals-contract';
import type { PaymentProvider } from '@repo/payments';
import { setupRoutes } from './routes';
import { createFileClock, injectClock, systemClock } from './utils/clock';
import { configureOpenAPI } from './utils/configure-open-api';
import { createApp } from './utils/create-app';
import { assertMailCaptureIsLocal } from './utils/e2e-mail-capture';
import { registerEntityFetchers } from './utils/entity-fetchers';
import { env } from './utils/env';
import { defaultPaymentProvider, injectPaymentProvider } from './utils/payment-provider';

/**
 * The composition root of `apps/api`.
 *
 * @param options.clock - The clock the app reads (AC:B1:17). Omitted, as in
 *   production (`src/index.ts`), it is the system time; tests pass the
 *   adjustable clock of `@repo/test-clock`.
 * @param options.paymentProvider - The injected gateway; production uses the
 *   Mercado Pago adapter and integration tests can supply the fake subpath.
 * @returns The Hono app
 */
const initApp = (
    options: { readonly clock?: Clock; readonly paymentProvider?: PaymentProvider } = {}
) => {
    // The one line that decides which clock both halves read: the system time
    // unless the caller (a test) injects another (contract §5 item 5, B1).
    const fileClockPath = env.HOSPEDA_E2E_CLOCK_FILE;
    assertMailCaptureIsLocal({
        captureUrl: env.HOSPEDA_E2E_MAIL_CAPTURE_URL,
        siteUrl: env.HOSPEDA_SITE_URL
    });
    if (options.clock === undefined && fileClockPath) {
        const siteHost = new URL(env.HOSPEDA_SITE_URL).hostname;
        if (siteHost !== 'localhost' && siteHost !== '127.0.0.1') {
            throw new Error(
                'HOSPEDA_E2E_CLOCK_FILE is only allowed when HOSPEDA_SITE_URL uses localhost or 127.0.0.1'
            );
        }
    }
    const clock =
        options.clock ?? (fileClockPath ? createFileClock({ path: fileClockPath }) : systemClock);
    injectClock({ clock });
    injectPaymentProvider({
        provider: options.paymentProvider ?? defaultPaymentProvider({ clock })
    });

    // Wire entity fetchers BEFORE any route handlers can run so the
    // ownershipMiddleware (used by protected accommodation patch/update/softDelete
    // and similar) can resolve entities. Without this call the fetchers Map is
    // empty and every ownership-guarded route fails with HTTP 500
    // "Entity type not configured".
    registerEntityFetchers();

    const app = createApp();

    setupRoutes(app);

    // Configure OpenAPI AFTER all routes are registered (only in non-production)
    if (env.NODE_ENV !== 'production') {
        configureOpenAPI(app);
    }

    return app;
};

export { initApp };
