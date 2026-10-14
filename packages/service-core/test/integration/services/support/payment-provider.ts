import type { PaymentProvider } from '@repo/payments';
import type { FakePaymentProvider } from '@repo/payments/fake';

/** Namespace the fake's resettable ids because integration files share a database. */
export function namespaceFake(fake: FakePaymentProvider): PaymentProvider {
    const prefix = `${crypto.randomUUID()}:`;
    const external = (id: string) => `${prefix}${id}`;
    const internal = (id: string) => (id.startsWith(prefix) ? id.slice(prefix.length) : id);
    return {
        capabilitySupport: fake.capabilitySupport,
        async authorize(input) {
            const result = await fake.authorize(input);
            return { ...result, authorizationId: external(result.authorizationId) };
        },
        charge: (input) =>
            fake.charge({ ...input, authorizationId: internal(input.authorizationId) }),
        changeAmount: (input) =>
            fake.changeAmount({ ...input, authorizationId: internal(input.authorizationId) }),
        pause: (input) => fake.pause({ authorizationId: internal(input.authorizationId) }),
        resume: (input) => fake.resume({ authorizationId: internal(input.authorizationId) }),
        cancel: (input) => fake.cancel({ authorizationId: internal(input.authorizationId) }),
        refund: (input) => fake.refund(input),
        readAuthorization: (input) =>
            fake.readAuthorization({ authorizationId: internal(input.authorizationId) }),
        searchAuthorizations: async (input) => {
            const result = await fake.searchAuthorizations(input);
            return {
                authorizations: result.authorizations.map((authorization) => ({
                    ...authorization,
                    authorizationId: external(authorization.authorizationId)
                }))
            };
        },
        listCharges: (input) =>
            fake.listCharges({ authorizationId: internal(input.authorizationId) }),
        readCharge: (input) => fake.readCharge(input),
        readOrder: (input) => fake.readOrder(input),
        searchOrders: (input) => fake.searchOrders(input),
        decodeNotice: (input) => fake.decodeNotice(input)
    };
}
