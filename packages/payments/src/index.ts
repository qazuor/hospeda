/**
 * Entry point of `@repo/payments`, the payments package.
 *
 * - the eight-capability interface (`PaymentProvider`) and its types;
 * - the Mercado Pago adapter; the in-memory fake is exported only by `./fake`;
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
    type AuthorizationCreationConfirmation,
    type AuthorizationCreationField,
    confirmAuthorizationCreation,
    type UnappliedCreationField
} from './provider/confirm-creation';
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
    type PaymentProviderErrorInput,
    type RefundRefusal,
    type TransientProviderFailure
} from './provider/errors';
export type {
    AuthorizationRef,
    AuthorizationSearchInput,
    AuthorizationSearchResult,
    AuthorizationSnapshot,
    AuthorizationStatus,
    AuthorizationSummary,
    AuthorizeInput,
    AuthorizeResult,
    BillingCadence,
    ChangeAmountInput,
    ChargeInput,
    ChargePurpose,
    ChargeRef,
    ChargeRefund,
    ChargeResult,
    ChargeSnapshot,
    ChargeStatus,
    Money,
    MutationAcknowledgement,
    NoticeDelivery,
    NoticeResourceKind,
    OrderRef,
    OrderSearchInput,
    OrderSearchResult,
    OrderSnapshot,
    OrderSummary,
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
export { runWithProviderReadScope, shareProviderReadForAct } from './provider/provider-read-scope';
export {
    AuthorizationRefSchema,
    AuthorizationSearchInputSchema,
    AuthorizeInputSchema,
    ChangeAmountInputSchema,
    ChargeInputSchema,
    ChargeRefSchema,
    MoneySchema,
    NoticeDeliverySchema,
    OrderRefSchema,
    OrderSearchInputSchema,
    PaymentProviderOptionsSchema,
    parseProviderInput,
    RefundInputSchema
} from './provider/schemas';
export {
    currentTrafficContext,
    runWithTrafficClass,
    type TrafficClass,
    type TrafficContext,
    type TrafficCounterSink
} from './provider/traffic-context';
// HOS-1999 provider traffic governor API (appended to keep composition changes conflict-light).
export {
    type CoolDownStore,
    GOVERNOR_BASE_BACKOFF_MS,
    GOVERNOR_BURST,
    GOVERNOR_INTERACTIVE_MAX_WAIT_MS,
    GOVERNOR_INTERACTIVE_RESERVE,
    GOVERNOR_MAX_BACKOFF_COOLDOWN_MS,
    GOVERNOR_MAX_RETRY_AFTER_COOLDOWN_MS,
    GOVERNOR_MAX_WAIT_SAMPLES,
    GOVERNOR_RATE_PER_SECOND,
    GOVERNOR_WINDOW_MS,
    type GovernorMode,
    type InteractiveRateLimitedInfo,
    ProviderTrafficGovernor,
    type TrafficCounter,
    type TrafficWindow
} from './provider/traffic-governor';
