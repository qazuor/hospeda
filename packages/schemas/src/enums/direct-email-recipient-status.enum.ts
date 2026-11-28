/**
 * Per-recipient status of a direct email (HOS-2685).
 *
 * Transitions:
 *   - Created as `SENT` (provider accepted the message), `FAILED` (provider
 *     rejected it, with a reason) or `SUPPRESSED` (address on the suppression
 *     list, never sent).
 *   - `SENT` → `DELIVERED` → `OPENED` or `BOUNCED` from Brevo webhook events.
 */
export enum DirectEmailRecipientStatusEnum {
    SENT = 'sent',
    FAILED = 'failed',
    SUPPRESSED = 'suppressed',
    DELIVERED = 'delivered',
    OPENED = 'opened',
    BOUNCED = 'bounced'
}
