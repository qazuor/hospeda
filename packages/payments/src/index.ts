/**
 * Entry point of `@repo/payments`, the payments package.
 *
 * - the eight-capability interface (`PaymentProvider`) and its types;
 * - its two implementations: the in-memory fake and the Mercado Pago adapter;
 * - the probe manifest;
 * - the re-read rules every caller inherits: a mutation is confirmed by
 *   re-reading field by field (`confirmAuthorizationMutation`, INV:D5), and a
 *   decision refuses a read by id older than its own start
 *   (`assertFreshForAct`, INV:D17);
 * - the approval link is shown only sanitized (`sanitizeApprovalUrl`, INV:D10).
 *
 * `stampProviderRead`, the only builder of a `ProviderRead`, is deliberately
 * NOT exported: only an implementation of the interface builds a read.
 */
export { MERCADOPAGO_CAPABILITY_SUPPORT } from './adapters/mercadopago/mercadopago-capability-support';
export { MercadoPagoPaymentProvider } from './adapters/mercadopago/mercadopago-payment-provider';
export {
    FAKE_LIES,
    FAKE_LISTS,
    FAKE_LISTS_PATH,
    FAKE_RULES,
    FAKE_SIMULATIONS,
    type FakeLie,
    type FakeLieId,
    type FakeLists,
    FakeListsSchema,
    type FakeMeasurement,
    type FakeRule,
    type FakeSimulation,
    type FakeSimulationId,
    MEASUREMENT_ACCOUNTS,
    parseFakeLists
} from './fake/fake-lists';
export {
    decodeFakeNotice,
    decodeFakeNoticeBody,
    encodeFakeNotice,
    encodeFakeNoticeBody,
    FAKE_NOTICE_CONTENT_TYPES,
    FakeNoticeBodySchema,
    type FakeNoticeFormat
} from './fake/fake-notice';
export {
    type FakePaymentProviderOptions,
    FakePaymentProviderOptionsSchema,
    type HonestAbout,
    type Simulate
} from './fake/fake-options';
export {
    FAKE_NOTICE_CHANNEL_HEADER,
    FAKE_NOTICE_DELAY_MS,
    type FakeNoticeChannel
} from './fake/fake-outbox';
export {
    FAKE_CAPABILITY_SUPPORT,
    FAKE_HONEST_LINK_LIFETIME_MS,
    FakePaymentProvider,
    NOT_REFUNDABLE_MESSAGE
} from './fake/fake-payment-provider';
export {
    AMOUNT_ABOVE_CEILING_MESSAGE,
    AMOUNT_BELOW_FLOOR_MESSAGE,
    FAKE_AMOUNT_CEILING_MINOR,
    FAKE_AMOUNT_FLOOR_MINOR,
    FAKE_CURRENCY,
    nextChargeBatch
} from './fake/fake-rules';
export {
    isProbeSubject,
    PROBE_MANIFEST,
    PROBE_MANIFEST_PATH,
    type ProbeManifest,
    ProbeManifestSchema,
    parseProbeManifest
} from './probes/probe-manifest';
export {
    ApprovalUrlRejectedError,
    type ApprovalUrlRejection,
    BROKEN_APPROVAL_PARAMETER,
    sanitizeApprovalUrl
} from './provider/approval-url';
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
    type AuthorizationMutableField,
    type AuthorizationMutationConfirmation,
    confirmAuthorizationMutation,
    type SentAuthorizationFields,
    type UnappliedField
} from './provider/confirm-mutation';
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
    type ActStart,
    actStartInstant,
    assertFreshForAct,
    type ProviderRead,
    ProviderReadRejectedError,
    type ProviderReadRejectedErrorInput,
    type ProviderReadRejection
} from './provider/provider-read';
export {
    AuthorizationRefSchema,
    AuthorizeInputSchema,
    ChangeAmountInputSchema,
    ChargeInputSchema,
    ChargeRefSchema,
    MoneySchema,
    NoticeDeliverySchema,
    PaymentProviderOptionsSchema,
    parseProviderInput,
    RefundInputSchema
} from './provider/schemas';
