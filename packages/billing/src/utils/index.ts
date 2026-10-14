// HOS-764: shared MercadoPago `status_detail` → i18n reason key mapper, used by
// the apps/web checkout failure page and (phase 2) the apps/api payment-failed
// email, so the payer never reads a raw provider code.
export type { CheckoutReasonI18nKey, CheckoutReasonKey } from './resolve-reason.js';
export { resolveReasonI18nKey, resolveReasonKey } from './resolve-reason.js';
export {
    resolveSignupDeclinedMessage,
    SIGNUP_DECLINED_CAUSE_BY_STATUS_DETAIL,
    type SignupDeclinedCause,
    type SignupDeclinedRetry
} from './signup-declined-reason.js';
