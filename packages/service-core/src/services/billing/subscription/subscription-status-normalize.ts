/**
 * Subscription Status Normalization — re-export (HOS-1310).
 *
 * The implementation moved to
 * `packages/billing/src/predicates/subscription-status-normalize.ts`. Read that
 * module's docblock for the two vocabularies, the `unpaid → PAST_DUE` decision,
 * and why `QZPAY_STORED_STATUS_ALIASES` must never be merged with the
 * similarly-named provider-read map in `./subscription-status-provider.ts`.
 *
 * It moved because the liveness predicates in `@repo/billing` are consumers of
 * exactly the same kind as the state machine here — handed a *stored* status,
 * comparing it against Hospeda-vocabulary literals — and `@repo/service-core`
 * depends on `@repo/billing`, not the other way round. The alternative was a
 * second copy of a vocabulary map, which is the HOS-108 mechanism itself.
 *
 * This file stays as a re-export rather than being deleted so that
 * `@repo/service-core`'s public API, the relative import in
 * `./subscription-status-transitions.ts`, and every `import { ... } from
 * '@repo/service-core'` call site are unchanged by the move.
 *
 * @module services/subscription-status-normalize
 */

export { normalizeStoredSubscriptionStatus } from '@repo/billing';
