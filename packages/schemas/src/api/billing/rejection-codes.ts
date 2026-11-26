/**
 * @file rejection-codes.ts
 * Single source of truth for the closed sets of typed rejection `reason`s that
 * the billing administrative actions return.
 *
 * The tuples live in `@repo/schemas` — and not in `@repo/service-core`, which is
 * server only — so both the API and the admin panel can import them. Each tuple
 * is exported `as const` together with a derived union type, so a consumer that
 * exhaustively maps the codes (a `Record<XRejection, …>`) fails to typecheck the
 * moment the backend adds or renames a code.
 *
 * @module rejection-codes
 */

/** Every `reason` administrative action 17 (plan retirement migration) rejects with. */
export const PLAN_MIGRATION_REJECTIONS = [
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'PLAN_VERSION_NOT_FOUND',
    'PLAN_MIGRATION_SOURCE_NOT_RETIRED',
    'PLAN_MIGRATION_TARGET_NOT_SELLABLE',
    'PLAN_MIGRATION_VERTICAL_MISMATCH',
    'PLAN_MIGRATION_SAME_VERSION',
    'PLAN_MIGRATION_EMPTY_COHORT',
    'PLAN_MIGRATION_COHORT_CHANGED',
    'INVALID_PLAN_MIGRATION_INPUT',
    'PLAN_MIGRATION_INCREASE_OTHER_PLAN',
    'PLAN_MIGRATION_INCREASE_SOURCE_CURRENT',
    'PLAN_MIGRATION_INCREASE_CYCLE_MISSING',
    'PLAN_MIGRATION_NOT_FOUND',
    'PLAN_MIGRATION_ALREADY_CANCELLED'
] as const;

/** One typed action 17 (plan retirement migration) rejection. */
export type PlanMigrationRejection = (typeof PLAN_MIGRATION_REJECTIONS)[number];

/** Every `reason` a rejection of the subscription revocation (S36) carries. */
export const REVOKE_SUBSCRIPTION_REJECTIONS = [
    'SUBSCRIPTION_NOT_FOUND',
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'REVOCATION_NOT_PRINCIPAL',
    'REVOCATION_STATE_NOT_ALLOWED',
    'REVOCATION_NO_CREDITED_PAYMENT',
    'REVOCATION_WINDOW_CLOSED',
    'REVOCATION_AMOUNT_UNAVAILABLE',
    'REVOCATION_PAYMENT_CHANGED',
    'REVOCATION_STATE_CHANGED',
    'PAYMENT_NOT_REFUNDABLE',
    'REFUND_EXCEEDS_BALANCE',
    'REFUND_AMOUNT_INVALID'
] as const;

/** A rejection reason of the subscription revocation (S36). */
export type RevokeSubscriptionRejection = (typeof REVOKE_SUBSCRIPTION_REJECTIONS)[number];

/** Stable `reason`s returned by MP4 (registering a late manual payment). */
export const REGISTER_LATE_MANUAL_PAYMENT_REJECTIONS = [
    'SUBSCRIPTION_NOT_FOUND',
    'MANUAL_PAYMENT_NOT_FOUND',
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'MANUAL_PAYMENT_NOT_MANUAL',
    'MANUAL_PAYMENT_NOT_DECLARED_UNPAID',
    'MANUAL_PAYMENT_NOT_SUSPENDED',
    'MANUAL_PAYMENT_CONDITION_FAILED',
    'MANUAL_PAYMENT_COVERAGE_CONFLICT',
    'RETAINED_PAYMENT',
    'LOST_RACE'
] as const;

/** One MP4 (registering a late manual payment) rejection. */
export type RegisterLateManualPaymentRejection =
    (typeof REGISTER_LATE_MANUAL_PAYMENT_REJECTIONS)[number];

/** Every `reason` a rejection of `retryRefundProviderCalls` carries. */
export const RETRY_REFUND_PROVIDER_CALLS_REJECTIONS = [
    'REFUND_NOT_FOUND',
    'REFUND_SOURCE_NOT_FOUND',
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'REFUND_NOT_CONFIRMED',
    'REFUND_SOURCE_NOT_PROVIDER_REFUNDABLE',
    'REFUND_HAS_NO_UNANSWERED_CALL',
    'REFUND_PAST_PROVIDER_WINDOW',
    'REFUND_CALL_TOO_OLD_TO_RETRY',
    'REFUND_STATE_CHANGED',
    'REFUND_RETRY_IN_PROGRESS'
] as const;

/** A rejection reason of `retryRefundProviderCalls`. */
export type RetryRefundProviderCallsRejection =
    (typeof RETRY_REFUND_PROVIDER_CALLS_REJECTIONS)[number];

/** Every `reason` a rejection of `settleRefundRemainder` carries. */
export const SETTLE_REFUND_REMAINDER_REJECTIONS = [
    'REFUND_AMOUNT_INVALID',
    'EXTERNAL_REFERENCE_INVALID',
    'REFUND_NOT_FOUND',
    'REFUND_SOURCE_NOT_FOUND',
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'REFUND_NOT_CONFIRMED',
    'REFUND_CALL_UNANSWERED',
    'OTHER_REFUND_CALL_UNANSWERED',
    'REFUND_HAS_NO_ACCEPTED_CALL',
    'ACCEPTED_PART_NOT_ACCREDITED',
    'REMAINDER_AMOUNT_MISMATCH',
    'EXTERNAL_REFERENCE_ALREADY_SETTLED',
    'REMAINDER_NOT_FOUND_AT_PROVIDER',
    'UNCITED_PROVIDER_REFUND_ON_CHARGE',
    'REFUND_STATE_CHANGED',
    'REFUND_RETRY_IN_PROGRESS'
] as const;

/** A rejection reason of `settleRefundRemainder`. */
export type SettleRefundRemainderRejection = (typeof SETTLE_REFUND_REMAINDER_REJECTIONS)[number];

/** Every `reason` a rejection of `settleExternalRefund` carries. */
export const SETTLE_EXTERNAL_REFUND_REJECTIONS = [
    'REFUND_AMOUNT_INVALID',
    'EXTERNAL_REFERENCE_INVALID',
    'REFUND_SOURCE_NOT_FOUND',
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'PAYMENT_NOT_REFUNDABLE',
    'MANUAL_PAYMENT_SCOPE_REQUIRED',
    'MANUAL_PAYMENT_SCOPE_NOT_ALLOWED',
    'EXTERNAL_REFERENCE_ALREADY_SETTLED',
    'REFUND_NOT_FOUND',
    'REFUND_NOT_OPEN',
    'OPEN_REQUESTS_AMBIGUOUS',
    'REQUESTED_AMOUNT_MISMATCH',
    'REFUND_EXCEEDS_BALANCE',
    'REFUND_STATE_CHANGED',
    'RETAINED_PAYMENT_SUCCESSION_OPEN'
] as const;

/** A rejection reason of `settleExternalRefund`. */
export type SettleExternalRefundRejection = (typeof SETTLE_EXTERNAL_REFUND_REJECTIONS)[number];

/** Every `reason` a rejection of `settleExternalCharge` carries. */
export const SETTLE_EXTERNAL_CHARGE_REJECTIONS = [
    'CHARGE_NOT_FOUND',
    'CHARGE_NOT_LINKED',
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'CHARGE_NOT_SETTLEABLE',
    'CHARGE_NOT_APPROVED',
    'CHARGE_ALREADY_RECORDED'
] as const;

/** A rejection reason returned when an external charge cannot be settled. */
export type SettleExternalChargeRejection = (typeof SETTLE_EXTERNAL_CHARGE_REJECTIONS)[number];

/** Every typed rejection of the admin S15 action (lifting a reconciliation mark). */
export const LIFT_RECONCILIATION_MARK_REJECTIONS = [
    'MARK_NOT_FOUND',
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'MARK_ALREADY_LIFTED',
    'MARK_VERSION_CONFLICT',
    'MARK_HAS_UNRESOLVED_PAYMENTS',
    'MARK_PAYMENT_NOT_HUNG',
    'MARK_CLOSES_ONLY_BY_REFUND'
] as const;

/** A typed rejection of the admin S15 action (lifting a reconciliation mark). */
export type LiftReconciliationMarkRejection = (typeof LIFT_RECONCILIATION_MARK_REJECTIONS)[number];

/** Rejection reasons for ACC_21 promotional code administration. */
export const PROMO_CODE_ADMIN_REJECTIONS = [
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'PROMO_CODE_NOT_FOUND',
    'PROMO_CODE_ALREADY_EXISTS',
    'PROMO_CODE_ALREADY_CLOSED',
    'INVALID_PROMO_CODE_INPUT'
] as const;

/** A typed rejection reason produced by a promotional code admin act. */
export type PromoCodeAdminRejection = (typeof PROMO_CODE_ADMIN_REJECTIONS)[number];
