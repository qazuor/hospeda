export type {
    DatabaseState,
    DriftCheckResult,
    DriftItem,
    DriftSeverity
} from './config-drift-check.js';
export { checkConfigDrift, formatDriftReport } from './config-drift-check.js';
// HOS-764: shared MercadoPago `status_detail` → i18n reason key mapper, used by
// the apps/web checkout failure page and (phase 2) the apps/api payment-failed
// email, so the payer never reads a raw provider code.
export type { CheckoutReasonI18nKey, CheckoutReasonKey } from './resolve-reason.js';
export { resolveReasonI18nKey, resolveReasonKey } from './resolve-reason.js';
