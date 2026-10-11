/** Test-only Mercado Pago-shaped HTTP shell around the in-memory fake. */

export type {
    AdjustableFakeServerClock,
    FakeProviderRequest,
    FakeProviderServer,
    FakeProviderServerOptions
} from './fake-provider-server';
export { startFakeProviderServer } from './fake-provider-server';
