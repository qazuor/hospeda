import { randomUUID } from 'node:crypto';
import { billingDeadlineVersions, getDb } from '@repo/db';
import { MercadoPagoPaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { startFakeProviderServer } from '@repo/payments/fake-server';
import { createAdjustableClock } from '@repo/test-clock';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { createLifter, createSignupOption, SIGNING_KEY } from './mercadopago-delegates-fixtures';

/** API and provider fixture configured to return an approved first charge. */
export async function startPromoChargeFixture() {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET = SIGNING_KEY;
    await testDb.setup();
    validateApiEnv();
    const clock = createAdjustableClock({ start: new Date('2026-10-12T12:00:00.000Z') });
    const fake = new FakePaymentProvider({
        clock,
        idNamespace: randomUUID(),
        honestAbout: [
            { lie: 'M1', why: 'the webhook fixture requires an authorization to be created' },
            { lie: 'M8', why: 'the promo counter scenario requires an approved charge' }
        ],
        withoutBehaviour: [
            { behaviour: 'RP12', why: 'the fixture isolates one charge on a subscription' }
        ]
    });
    const server = await startFakeProviderServer({ provider: fake, clock });
    const app = initApp({
        clock,
        paymentProvider: new MercadoPagoPaymentProvider({
            clock,
            baseUrl: server.url,
            accessToken: 'test-token'
        })
    });
    await getDb()
        .insert(billingDeadlineVersions)
        .values({
            version: 1,
            values: {
                '10': { cardHours: 72, manualDays: 7 },
                '11': { noticeDays: 60, contactDays: [30, 7] },
                '12': { noticeDays: 60, contactDays: [30, 7] },
                '13': { daysBefore: [5, 1] },
                '14': { daysBefore: 7 },
                '15': { hoursRemaining: 24 },
                '16': { days: 7 },
                '17': { days: 7 },
                '18': { days: 180 },
                '19': { minutes: 60 }
            }
        })
        .onConflictDoNothing();
    return {
        app,
        billingOptionId: await createSignupOption(),
        clock,
        fake,
        lifterId: await createLifter(),
        server,
        async stop() {
            await server.close();
            await testDb.teardown();
        }
    };
}
