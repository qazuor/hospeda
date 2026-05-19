/**
 * Lifecycle states for a newsletter campaign (SPEC-101).
 *
 * Transitions:
 *   - `DRAFT` is the only state in which a campaign may be edited or deleted.
 *   - `DRAFT` → `SENDING` on admin dispatch confirmation; deliveries are
 *     enqueued and worker processing begins.
 *   - `SENDING` → `SENT` automatically when every delivery row reaches a
 *     terminal status (delivered | failed | skipped). Driven by the
 *     newsletter-close-campaigns cron job.
 *   - `SENDING` → `CANCELLED` on admin abort; pending deliveries are flipped
 *     to `skipped`. In-flight worker batches may still finish (accepted edge).
 */
export enum NewsletterCampaignStatusEnum {
    DRAFT = 'draft',
    SENDING = 'sending',
    SENT = 'sent',
    CANCELLED = 'cancelled'
}
