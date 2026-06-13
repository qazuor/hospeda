/**
 * Payment adapter configurations for Hospeda
 *
 * Provides configured payment adapters for different payment providers
 */

export {
    createMercadoPagoAdapter,
    getDefaultCountry,
    getDefaultCurrency,
    type MercadoPagoAdapterConfig
} from './mercadopago.js';

// SPEC-217: deterministic in-memory MercadoPago adapter stub used under the
// test-control gate (HOSPEDA_QZPAY_TEST_CONTROL_ENABLED=true) so the
// accommodation-publish trial flow succeeds offline in CI.
export { createStubMercadoPagoAdapter } from './mercadopago-stub.js';

// SPEC-092 T-036: test-only control surface for E2E failure injection.
// Gated by HOSPEDA_QZPAY_TEST_CONTROL_ENABLED=true; no-op otherwise.
export {
    applyTestControl,
    delayNext,
    failNext,
    getRecordedCalls,
    getTestControlSnapshot,
    isTestControlEnabled,
    resetTestControl,
    type ControllableOperation
} from './qzpay-test-control.js';
