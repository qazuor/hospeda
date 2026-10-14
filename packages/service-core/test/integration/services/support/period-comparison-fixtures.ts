import { providerLinks } from '@repo/db';
import type { FakePaymentProvider } from '@repo/payments/fake';
import { getServiceTestDb } from '../helpers.js';

/** Links a local row to a real but unapproved fake authorization for state TEST:B11:7. */
export async function attachPendingFakeAuthorization(input: {
    readonly subscriptionId: string;
    readonly fake: FakePaymentProvider;
}) {
    const authorization = await input.fake.authorize({
        reference: input.subscriptionId,
        amount: { amountMinor: 250000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'state comparison pending authorization fixture',
        returnUrl: 'https://example.test/return',
        payerEmail: `pending-${crypto.randomUUID()}@example.test`
    });
    await getServiceTestDb().insert(providerLinks).values({
        subscriptionId: input.subscriptionId,
        provider: 'MERCADO_PAGO',
        providerId: authorization.authorizationId
    });
    return { providerId: authorization.authorizationId };
}
