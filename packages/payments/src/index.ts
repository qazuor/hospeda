/**
 * Entry point of `@repo/payments`, the payments package.
 *
 * - the eight-capability interface (`PaymentProvider`) and its types;
 * - its two implementations: the in-memory fake and the Mercado Pago adapter;
 * - the probe manifest.
 */
export { MERCADOPAGO_CAPABILITY_SUPPORT } from './adapters/mercadopago/mercadopago-capability-support';
export { MercadoPagoPaymentProvider } from './adapters/mercadopago/mercadopago-payment-provider';
export {
    decodeFakeNoticeBody,
    encodeFakeNoticeBody,
    FakeNoticeBodySchema
} from './fake/fake-notice';
export { FAKE_CAPABILITY_SUPPORT, FakePaymentProvider } from './fake/fake-payment-provider';
export {
    isProbeSubject,
    PROBE_MANIFEST,
    PROBE_MANIFEST_PATH,
    type ProbeManifest,
    ProbeManifestSchema,
    parseProbeManifest
} from './probes/probe-manifest';
export {
    type CapabilityGap,
    type CapabilityGapHandling,
    type CapabilitySupport,
    type CapabilitySupportMap,
    NOT_ASKED_OF_THE_PROVIDER,
    PAYMENT_CAPABILITIES,
    type PaymentCapability
} from './provider/capabilities';
export {
    CAPABILITY_METHODS,
    type EveryMethodHasACapability,
    PROVIDER_METHODS
} from './provider/capability-methods';
export {
    PaymentProviderError,
    type PaymentProviderErrorCode,
    type PaymentProviderErrorInput
} from './provider/errors';
export type {
    AuthorizationRef,
    AuthorizationSnapshot,
    AuthorizationStatus,
    AuthorizeInput,
    AuthorizeResult,
    BillingCadence,
    ChangeAmountInput,
    ChargeInput,
    ChargeRef,
    ChargeResult,
    ChargeSnapshot,
    ChargeStatus,
    Money,
    MutationAcknowledgement,
    NoticeDelivery,
    NoticeResourceKind,
    PaymentProvider,
    PaymentProviderMethod,
    ProviderNotice,
    RefundInput,
    RefundResult
} from './provider/payment-provider';
export {
    type AssertNoProviderConcept,
    type DetectorCatchesNestedConcepts,
    type PaymentProviderNamesNoProviderConcept,
    PROVIDER_CONCEPT_TERMS,
    type ProviderConceptsIn,
    type ProviderConceptTerm
} from './provider/provider-concepts';
export {
    AuthorizationRefSchema,
    AuthorizeInputSchema,
    ChangeAmountInputSchema,
    ChargeInputSchema,
    ChargeRefSchema,
    MoneySchema,
    NoticeDeliverySchema,
    parseProviderInput,
    RefundInputSchema
} from './provider/schemas';
