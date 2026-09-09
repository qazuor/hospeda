/**
 * Partner Payment Review Cron Job (HOS-1299)
 *
 * Finds partners who are active with no record of payment for the current
 * period, and ASKS AN ADMIN what to do about it. It does not decide.
 *
 * ## Why this job does not take anybody down
 *
 * Owner decision, 2026-09-09. There are two mistakes an admin can make and they
 * are not symmetric:
 *
 * | Forgot to... | Costs |
 * | -- | -- |
 * | take down somebody who stopped paying | a month of product |
 * | record a payment that did come in | **a customer we cut off** |
 *
 * A silent automation always gets the expensive one wrong, because it cannot
 * tell "they did not pay" from "nobody wrote it down". So the machine's job
 * ends at the question, and the alert doubles as the reminder that the payment
 * may simply be unrecorded.
 *
 * This is why the flag lives in `partners.payment_review_state` and NOT in
 * `subscription_status`: that column is read by `getPublicBySlug`,
 * `findByFilters`, `countActivePartners` and the web's
 * `evaluatePartnerIndexability`, so moving it would 404 the page, `noindex` it,
 * drop it from the sitemap and drop it from the carousel — the takedown,
 * performed by the act of suspecting it.
 *
 * ## Why this is not a stage inside `partner-expiry`
 *
 * That job's contract is to ARCHIVE (`partner-expiry.job.ts`, which flips
 * `CANCELLED` + `ARCHIVED` unattended). Putting "flag for review" inside a job
 * whose every other line takes partners down is how, six months from now,
 * somebody moves one `await` and the owner's decision quietly becomes an
 * automation nobody remembers deciding against. Two contracts, two jobs.
 *
 * `partner-expiry` is also not reusable here for a duller reason: it reads
 * `endsAt <= now`, and nothing in the codebase writes `partners.endsAt` outside
 * the admin form, so its candidate set is empty for every partner the platform
 * activates on its own.
 *
 * ## Which partners it sees
 *
 * `PartnerModel.findDueForPaymentReview` — see its docblock for each exclusion.
 * In short: activated, past the confirmed period, no MercadoPago subscription,
 * content approved (the payment gate), not already flagged, not revoked.
 *
 * @module cron/jobs/partner-payment-review
 */

import { ENTITLEMENT_GRANTING_STATUSES } from '@repo/billing';
import { PartnerModel } from '@repo/db';
import { NotificationType } from '@repo/notifications';
import { PartnerPaymentReviewStateEnum } from '@repo/schemas';
import { PARTNER_PAYMENT_REVIEW_AFTER_DAYS } from '@repo/service-core';
import { env } from '../../utils/env.js';
import { apiLogger } from '../../utils/logger.js';
import { trySendNotification } from '../../utils/notification-helper.js';
import { resolveOpsRecipients } from '../../utils/ops-recipients.js';
import type { CronJobDefinition, CronJobResult } from '../types.js';

/**
 * The window, re-exported from its single home in `@repo/service-core`.
 *
 * NOT redeclared here. The confirmation endpoint pushes
 * `paymentConfirmedThrough` forward by exactly this amount when the admin does
 * not type a date, so a second copy would let a partner be confirmed for 30
 * days and re-asked about after 14 — forever, and invisibly.
 */
export const PAYMENT_REVIEW_AFTER_DAYS = PARTNER_PAYMENT_REVIEW_AFTER_DAYS;

/** Batch ceiling per tick, mirroring the other two partner crons. */
const BATCH_LIMIT = 100;

/** `now` shifted back by `days` — the cutoff the model compares against. */
export function paymentReviewCutoff(input: { readonly now: Date; readonly days: number }): Date {
    return new Date(input.now.getTime() - input.days * 24 * 60 * 60 * 1000);
}

/** Whole days between `from` and `now`, floored at 0. */
function daysSince(input: { readonly from: Date; readonly now: Date }): number {
    const elapsed = input.now.getTime() - input.from.getTime();
    return Math.max(0, Math.floor(elapsed / (24 * 60 * 60 * 1000)));
}

/** Readable Argentina-local date for the alert body. */
function formatCoveredThrough(date: Date): string {
    return date.toLocaleDateString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

export const partnerPaymentReviewJob: CronJobDefinition = {
    name: 'partner-payment-review',
    description:
        'Ask an admin whether a partner with no recorded payment should be taken down (HOS-1299). Never changes the partner state itself.',
    schedule: '30 4 * * *',
    enabled: true,
    timeoutMs: 120_000,

    handler: async (ctx): Promise<CronJobResult> => {
        const { logger, startedAt, dryRun } = ctx;
        const startMs = startedAt.getTime();

        logger.info('partner-payment-review: starting tick', {
            dryRun,
            startedAt: startedAt.toISOString()
        });

        try {
            const model = new PartnerModel();
            const due = await model.findDueForPaymentReview(
                {
                    confirmedThroughBefore: paymentReviewCutoff({
                        now: startedAt,
                        days: PAYMENT_REVIEW_AFTER_DAYS
                    }),
                    // The canonical set, passed in rather than imported by the
                    // model: `@repo/db` is in nearly every module graph in the
                    // monorepo, and `@repo/billing`'s single barrel drags the
                    // MercadoPago adapter along with it. This job already lives
                    // where billing is a legitimate dependency.
                    //
                    // It is what exempts `comp` (HOS-1160) and `courtesy`
                    // (HOS-180) — partners the platform gave the product to,
                    // who by definition never register a payment. Never replace
                    // this with a literal list.
                    exemptSubscriptionStatuses: ENTITLEMENT_GRANTING_STATUSES
                },
                BATCH_LIMIT
            );

            if (due.length === 0) {
                logger.info('partner-payment-review: nothing to ask about');
                return {
                    success: true,
                    message: 'No partners due for payment review',
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startMs
                };
            }

            if (dryRun) {
                logger.info('partner-payment-review: dry run — would ask about', {
                    count: due.length
                });
                return {
                    success: true,
                    message: `Dry run — would flag ${due.length} partner(s) for admin review`,
                    processed: due.length,
                    errors: 0,
                    durationMs: Date.now() - startMs,
                    details: { partnerIds: due.map((partner) => partner.id) }
                };
            }

            const recipients = resolveOpsRecipients();

            if (recipients.length === 0) {
                // WARN, not debug: with no address list the question reaches
                // nobody, and a question nobody is asked is indistinguishable
                // from the bug this job exists to close.
                apiLogger.warn(
                    { candidates: due.length },
                    'partner-payment-review: HOSPEDA_ADMIN_NOTIFICATION_EMAILS is unset; nobody can be asked'
                );
            }

            let flagged = 0;
            let errors = 0;

            for (const partner of due) {
                try {
                    // The ONLY write this job performs on a partner. Status,
                    // lifecycle, visibility and `endsAt` are all left exactly as
                    // they were — asking is not deciding, and a partner who paid
                    // must be no worse off for having been asked about.
                    await model.update(
                        { id: partner.id },
                        {
                            paymentReviewState: PartnerPaymentReviewStateEnum.PENDING_CONFIRMATION
                        }
                    );
                    flagged++;

                    // Written BEFORE the mail on purpose, and kept even if the
                    // mail fails: the flag is this job's whole memory (the model
                    // query skips a partner that already carries it), so
                    // stamping it after a failed send would re-ask every night.
                    // Same trade `unpaidNoticeSentAt` makes — and here the email
                    // is not the only channel, because the flag itself surfaces
                    // on the partner's admin detail.
                    const coveredFrom = partner.paymentConfirmedThrough ?? partner.startsAt;
                    if (!coveredFrom) {
                        // Unreachable via the model query, which requires
                        // `starts_at IS NOT NULL`. Guarded anyway so a future
                        // caller cannot turn it into a crash mid-batch.
                        continue;
                    }

                    const adminUrl = new URL(
                        `/partners/${partner.id}`,
                        env.HOSPEDA_ADMIN_URL
                    ).toString();

                    for (const recipientEmail of recipients) {
                        await trySendNotification({
                            type: NotificationType.ADMIN_PARTNER_PAYMENT_REVIEW,
                            recipientEmail,
                            recipientName: 'Equipo Hospeda',
                            // An operations mailbox, which may not correspond to
                            // any user row.
                            userId: null,
                            partnerName: partner.name,
                            coveredThroughLabel: formatCoveredThrough(new Date(coveredFrom)),
                            daysSinceCovered: daysSince({
                                from: new Date(coveredFrom),
                                now: startedAt
                            }),
                            adminUrl,
                            idempotencyKey: `partner-payment-review-${partner.id}-${recipientEmail}`
                        });
                    }
                } catch (err) {
                    errors++;
                    apiLogger.error(
                        {
                            partnerId: partner.id,
                            error: err instanceof Error ? err.message : String(err)
                        },
                        'partner-payment-review: failed to flag partner — continuing with the rest'
                    );
                }
            }

            logger.info('partner-payment-review: tick complete', {
                flagged,
                errors,
                durationMs: Date.now() - startMs
            });

            return {
                success: errors === 0,
                message: `Flagged ${flagged} partner(s) for admin review${
                    errors > 0 ? `, ${errors} error(s)` : ''
                }`,
                processed: flagged,
                errors,
                durationMs: Date.now() - startMs
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error('partner-payment-review: fatal error', { error: message });
            return {
                success: false,
                message: `Fatal error: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startMs
            };
        }
    }
};
