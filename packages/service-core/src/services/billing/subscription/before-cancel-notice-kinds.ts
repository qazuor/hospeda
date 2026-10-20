/**
 * The outbox template of each kind of notice that precedes a cancellation we execute at the
 * provider (DEC-MAIL-001). There is NO default (HOS-1683): every caller names its kind, so a
 * cancellation can never inherit another transition's text. The template is part of the
 * notice's dedupe key, so the sweep's retry must ask with the same kind as the first attempt.
 *
 * Only literals live here: the API adapter and the test mirror import this one source.
 */
export const BEFORE_CANCEL_TEMPLATE_BY_KIND = {
    /** S3: the pending authorization's window expired. The only kind that says so. */
    AUTHORIZATION_EXPIRED: 'billing.before-cancel',
    /** S16, and S1 when it re-cancels the `CHARGE_DECLINED` row S16 left (same dedupe key). */
    FIRST_CHARGE_DECLINED: 'billing.first-charge-declined-cancel',
    /** S36: the subscription was revoked (withdrawal). */
    REVOCATION: 'billing.revocation-cancel',
    /** REJECTION_REVIVED: a live authorization was found on an already closed row. */
    LIVE_AUTHORIZATION_ON_CLOSED_ROW: 'billing.closed-subscription-authorization-cancel',
    /** S11, and S12, which never calls on its own: it inherits S11's cancellation. */
    SCHEDULED_CANCELLATION: 'billing.scheduled-cancellation',
    /** The inherited Tourist VIP's clause. */
    TOURIST_VIP_INHERITED: 'billing.tourist-vip-inherited-cancel',
    /** S6: suspension for arrears (it retries itself, never through the sweep). */
    ARREARS_SUSPENSION: 'billing.arrears-suspension',
    /** A5: an orphaned addon's complement subscription (AC:B5:27). */
    ADDON_CANCELLED: 'billing.addon-cancelled',
    /** S13: a permanent grant cut the subscription's charge (B9a, HOS-1582). */
    PERMANENT_GRANT: 'billing.permanent-grant-cancel',
    /** S20: a permanent grant converted an addon to $0 and cut its complement's charge (B9a, HOS-1583). */
    PERMANENT_GRANT_ADDON: 'billing.permanent-grant-addon-cancel',
    /** S23 and S24: the person cancelled from SUSPENDED or GRACE_PERIOD; the service ends today. */
    DIRECT_CANCELLATION: 'billing.direct-cancellation'
} as const;

/** A kind of before-cancel notice; each one has its own template and no kind is a default. */
export type BeforeCancelNoticeKind = keyof typeof BEFORE_CANCEL_TEMPLATE_BY_KIND;
