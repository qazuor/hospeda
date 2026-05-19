/**
 * Lifecycle states of a newsletter subscriber row.
 *
 * Transitions:
 *   - `PENDING_VERIFICATION` → `ACTIVE` on successful HMAC token click (US-101-04).
 *   - `ACTIVE` → `UNSUBSCRIBED` on user opt-out, 1-click unsubscribe link, or
 *     account preferences toggle.
 *   - `ACTIVE` → `BOUNCED` on Brevo hard-bounce webhook.
 *   - `ACTIVE` → `COMPLAINED` on Brevo spam-complaint webhook.
 *   - `UNSUBSCRIBED` → `PENDING_VERIFICATION` on re-subscribe (new token issued).
 *
 * `BOUNCED` and `COMPLAINED` are terminal in MVP (no automatic re-activation).
 */
export enum NewsletterSubscriberStatusEnum {
    PENDING_VERIFICATION = 'pending_verification',
    ACTIVE = 'active',
    UNSUBSCRIBED = 'unsubscribed',
    BOUNCED = 'bounced',
    COMPLAINED = 'complained'
}
