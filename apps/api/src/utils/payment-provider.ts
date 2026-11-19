import type { Clock } from '@repo/billing-verticals-contract';
import { MercadoPagoPaymentProvider, type PaymentProvider } from '@repo/payments';
import {
    CHARGE_SNAPSHOT_PROVIDER,
    createChargeSnapshotRecordingProvider,
    createDbChargeSnapshotRecorder
} from '@repo/service-core';
import { env } from './env';
import { getMercadoPagoTrafficGovernor } from './mp-traffic-governor';

let injectedProvider: PaymentProvider | undefined;

/** Composition root injection; tests can supply the fake without importing it in production. */
export function injectPaymentProvider(input: { readonly provider: PaymentProvider }): void {
    injectedProvider = createChargeSnapshotRecordingProvider({
        provider: input.provider,
        recorder: createDbChargeSnapshotRecorder({ provider: CHARGE_SNAPSHOT_PROVIDER })
    });
}

export function defaultPaymentProvider(input: { readonly clock: Clock }): PaymentProvider {
    const governor = getMercadoPagoTrafficGovernor();
    return new MercadoPagoPaymentProvider({
        clock: input.clock,
        baseUrl: env.HOSPEDA_MERCADO_PAGO_API_BASE_URL,
        accessToken: env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN,
        timeoutMs: env.HOSPEDA_MERCADO_PAGO_TIMEOUT,
        // HOS-2179 (owner): a plain-http return URL on localhost is for local development
        // only. Allow-listed, so an absent or unknown NODE_ENV keeps https only.
        allowLocalHttpReturnUrl: env.NODE_ENV === 'development' || env.NODE_ENV === 'test',
        ...(governor ? { governor } : {})
    });
}

export function getPaymentProvider(): PaymentProvider {
    if (!injectedProvider) throw new Error('Payment provider has not been injected');
    return injectedProvider;
}
