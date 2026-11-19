/** Test-only Mercado Pago-shaped HTTP shell around the in-memory fake. */

export type {
    AdjustableFakeServerClock,
    FakeProviderRequest,
    FakeProviderServer,
    FakeProviderServerOptions,
    FakeProviderThrottle
} from './fake-provider-server';
export { startFakeProviderServer } from './fake-provider-server';
export type { MercadoPagoDeliveriesResult, MercadoPagoDelivery } from './mercadopago-deliveries';
export {
    DEFAULT_FAKE_PAYMENT_SCREEN_ORIGIN,
    FAKE_PAYMENT_SCREEN_PATH
} from './payment-pages-route';
export type { FakeProviderAccount } from './users-me-route';
