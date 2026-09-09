/**
 * Review state of a partner's PAYMENT, as opposed to their content (HOS-1299).
 *
 * Deliberately NOT a fifth value of `PartnerSubscriptionStatusEnum`, and the
 * reason is the whole point of the feature. That column is read by every
 * visibility surface the platform has — `PartnerService.getPublicBySlug`,
 * `PartnerModel.findByFilters`/`countActivePartners`, the web's
 * `evaluatePartnerIndexability` and through it the dynamic sitemap — so a
 * partner whose status stopped saying `active` is, in the same instant, a 404,
 * a `noindex`, an absence from the sitemap and an absence from the home
 * carousel. Suspecting that somebody has not paid would therefore have
 * PERFORMED the takedown, which is exactly the expensive mistake this state
 * exists to prevent: the owner's decision (2026-09-09) is that a partner who
 * did pay must never be taken down by a machine.
 *
 * The `partners` table already draws this line for its own reasons — see the
 * `revokedAt` docblock, which leaves `subscriptionStatus` alone so that "we
 * took them down" is never confused with "they stopped paying". This is the
 * third thing that column must not be made to mean.
 *
 * A single value, and null for everything else: `null` means "nothing is
 * pending", exactly like {@link PartnerContentReviewStateEnum} on a partner who
 * has never submitted anything. There is no `CONFIRMED`/`REFUSED` member on
 * purpose — a resolved review is a review that is over, and its outcome is
 * recorded where it is load-bearing (`paymentConfirmedThrough` moving forward,
 * or the existing revoke trio), not as a state the row carries forever.
 */
export enum PartnerPaymentReviewStateEnum {
    /**
     * The system found no record of payment for the current period and has
     * asked an admin whether to take the partner down.
     *
     * Carries no consequence by itself. Nothing reads it to decide whether the
     * partner is visible, billable or listed — it drives one admin queue and
     * one email, and the decision stays with the human.
     */
    PENDING_CONFIRMATION = 'pending_confirmation'
}
