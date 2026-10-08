import type { Clock } from '@repo/billing-verticals-contract';
import { MercadoPagoPaymentProvider, type PaymentProvider } from '@repo/payments';

let injectedProvider: PaymentProvider | undefined;

/** Composition root injection; tests can supply the fake without importing it in production. */
export function injectPaymentProvider(input: { readonly provider: PaymentProvider }): void {
    injectedProvider = input.provider;
}

export function defaultPaymentProvider(input: { readonly clock: Clock }): PaymentProvider {
    return new MercadoPagoPaymentProvider({ clock: input.clock });
}

export function getPaymentProvider(): PaymentProvider {
    if (!injectedProvider) throw new Error('Payment provider has not been injected');
    return injectedProvider;
}
