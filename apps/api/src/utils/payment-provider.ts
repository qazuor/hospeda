import type { Clock } from '@repo/billing-verticals-contract';
import { MercadoPagoPaymentProvider, type PaymentProvider } from '@repo/payments';
import { env } from './env';

let injectedProvider: PaymentProvider | undefined;

/** Composition root injection; tests can supply the fake without importing it in production. */
export function injectPaymentProvider(input: { readonly provider: PaymentProvider }): void {
    injectedProvider = input.provider;
}

export function defaultPaymentProvider(input: { readonly clock: Clock }): PaymentProvider {
    return new MercadoPagoPaymentProvider({
        clock: input.clock,
        baseUrl: env.HOSPEDA_MERCADO_PAGO_API_BASE_URL,
        accessToken: env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN,
        timeoutMs: env.HOSPEDA_MERCADO_PAGO_TIMEOUT
    });
}

export function getPaymentProvider(): PaymentProvider {
    if (!injectedProvider) throw new Error('Payment provider has not been injected');
    return injectedProvider;
}
