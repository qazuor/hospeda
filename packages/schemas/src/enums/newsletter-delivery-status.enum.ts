/**
 * Lifecycle states for a single newsletter delivery (SPEC-101).
 *
 * Transitions:
 *   - Created in `PENDING` at dispatch time.
 *   - `PENDING` → `DELIVERED` when the Brevo batch send succeeds and we
 *     persist the provider message id.
 *   - `PENDING` → `FAILED` after BullMQ retry budget is exhausted or the
 *     Brevo response is a permanent error.
 *   - `PENDING` → `SKIPPED` when the parent campaign is cancelled before
 *     this row is picked up by the worker (or the subscriber became
 *     unsubscribed/bounced between enqueue and send).
 *
 * Rows are immutable on terminal states; no transitions back to `PENDING`.
 */
export enum NewsletterDeliveryStatusEnum {
    PENDING = 'pending',
    DELIVERED = 'delivered',
    FAILED = 'failed',
    SKIPPED = 'skipped'
}
