/**
 * Partner Unpaid Reaper Cron Job (HOS-278 R-3)
 *
 * R-3 is "datos cargados que nunca se pagan — definir cuánto viven". The answer
 * is two stages, and NOTHING IS DESTROYED by either:
 *
 * - **Day 30** — one email telling the partner their ficha is still unpublished
 *   and will be archived if nothing changes. Sent exactly once, which is what
 *   `partners.unpaid_notice_sent_at` is for: without it this would go out every
 *   day from day 31 onward.
 * - **Day 90** — `lifecycleState` moves to `ARCHIVED`. The row, the content and
 *   the owner survive untouched, and an admin can reverse it. That is the whole
 *   point of choosing archive over delete: R-4 already established that
 *   destroying the evidence a partner was approved is the wrong trade, and a
 *   cron making that call unattended would be worse than an admin making it.
 *
 * ## Which partners this touches, and which it deliberately does not
 *
 * ONLY partners provisioned from an approved alliance lead (see
 * `PartnerModel.findUnpaidProvisioned`). A partner an admin typed in by hand is
 * that admin's working state; archiving it out from under them would be the
 * cron deciding their queue is stale. Same line migration 0080 drew for the
 * content-approval backfill.
 *
 * "Never paid" is `starts_at IS NULL`, not a `subscription_status` read: that
 * column is written only when a subscription actually activates. Reading the
 * status would also sweep up a partner who paid once and lapsed — a different
 * story, owned by dunning and by `partner-expiry`, not by this reaper.
 *
 * ## Relationship to `partner-expiry`
 *
 * Disjoint by construction. That job archives partners whose `endsAt` has
 * passed — partners who DID pay and whose term ran out. This one only ever sees
 * rows with `starts_at IS NULL`, which that job's `endsAt <= now` filter can
 * never match. Two populations, two jobs, no overlap.
 *
 * @module cron/jobs/partner-unpaid-reaper
 */

import { getDb, PartnerModel, users } from '@repo/db';
import { NotificationType } from '@repo/notifications';
import { LifecycleStatusEnum } from '@repo/schemas';
import { eq } from 'drizzle-orm';
import { apiLogger } from '../../utils/logger.js';
import { sendNotification } from '../../utils/notification-helper.js';
import type { CronJobDefinition, CronJobResult } from '../types.js';

/** Days of not paying before the one-time nudge goes out. */
export const UNPAID_NOTICE_AFTER_DAYS = 30;

/** Days of not paying before the listing is archived. */
export const UNPAID_ARCHIVE_AFTER_DAYS = 90;

/** Batch ceiling per stage, mirroring `partner-expiry`. */
const BATCH_LIMIT = 100;

/** `now` shifted back by `days`, as the model's `createdBefore` cutoff. */
export function cutoffFor({ now, days }: { readonly now: Date; readonly days: number }): Date {
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export const partnerUnpaidReaperJob: CronJobDefinition = {
    name: 'partner-unpaid-reaper',
    description:
        'Nudge unpaid provisioned partners at 30 days and archive them at 90 (HOS-278 R-3). Never deletes.',
    schedule: '45 4 * * *',
    enabled: true,
    timeoutMs: 120_000,

    handler: async (ctx): Promise<CronJobResult> => {
        const { logger, startedAt, dryRun } = ctx;
        const startMs = startedAt.getTime();

        logger.info('partner-unpaid-reaper: starting tick', {
            dryRun,
            startedAt: startedAt.toISOString()
        });

        try {
            const model = new PartnerModel();

            // ARCHIVE FIRST, then notify. The order matters: a partner past the
            // archive cutoff who somehow never got the notice should be
            // archived, not sent a "you have 60 days" email that is already
            // false. Running notify first would hand them exactly that.
            const toArchive = await model.findUnpaidProvisioned(
                {
                    createdBefore: cutoffFor({ now: startedAt, days: UNPAID_ARCHIVE_AFTER_DAYS }),
                    noticeState: 'any'
                },
                BATCH_LIMIT
            );

            const toNotify = (
                await model.findUnpaidProvisioned(
                    {
                        createdBefore: cutoffFor({
                            now: startedAt,
                            days: UNPAID_NOTICE_AFTER_DAYS
                        }),
                        noticeState: 'un-notified'
                    },
                    BATCH_LIMIT
                )
            ).filter((partner) => !toArchive.some((archived) => archived.id === partner.id));

            if (dryRun) {
                logger.info('partner-unpaid-reaper: dry run', {
                    wouldNotify: toNotify.length,
                    wouldArchive: toArchive.length
                });
                return {
                    success: true,
                    message: `Dry run — would notify ${toNotify.length} and archive ${toArchive.length} partner(s)`,
                    processed: toNotify.length + toArchive.length,
                    errors: 0,
                    durationMs: Date.now() - startMs,
                    details: {
                        notifyIds: toNotify.map((p) => p.id),
                        archiveIds: toArchive.map((p) => p.id)
                    }
                };
            }

            let archived = 0;
            let notified = 0;
            let errors = 0;

            for (const partner of toArchive) {
                try {
                    await model.update(
                        { id: partner.id },
                        { lifecycleState: LifecycleStatusEnum.ARCHIVED }
                    );
                    archived++;
                } catch (err) {
                    errors++;
                    apiLogger.error(
                        {
                            partnerId: partner.id,
                            error: err instanceof Error ? err.message : String(err)
                        },
                        'partner-unpaid-reaper: failed to archive — continuing with the rest'
                    );
                }
            }

            for (const partner of toNotify) {
                try {
                    // The stamp is written EVEN IF the email fails below, and
                    // that is deliberate: a transport error must not turn into
                    // a daily retry loop against the same address. One missed
                    // notice is a smaller harm than thirty delivered ones, and
                    // the archive stage still runs regardless.
                    await model.update({ id: partner.id }, { unpaidNoticeSentAt: new Date() });

                    if (partner.ownerUserId == null) {
                        // Nobody to write to. The stamp above still went in, so
                        // this partner is not reconsidered every night.
                        apiLogger.info(
                            { partnerId: partner.id },
                            'partner-unpaid-reaper: unpaid partner has no owner — nobody notified'
                        );
                        notified++;
                        continue;
                    }

                    const db = getDb();
                    const [owner] = await db
                        .select({ email: users.email, displayName: users.displayName })
                        .from(users)
                        .where(eq(users.id, partner.ownerUserId))
                        .limit(1);

                    if (!owner?.email) {
                        apiLogger.warn(
                            { partnerId: partner.id, ownerUserId: partner.ownerUserId },
                            'partner-unpaid-reaper: owner has no email — notice not sent'
                        );
                        notified++;
                        continue;
                    }

                    await sendNotification({
                        type: NotificationType.PARTNER_UNPAID_NOTICE,
                        recipientEmail: owner.email,
                        recipientName: owner.displayName ?? partner.name,
                        userId: partner.ownerUserId,
                        partnerName: partner.name,
                        daysUntilArchive: UNPAID_ARCHIVE_AFTER_DAYS - UNPAID_NOTICE_AFTER_DAYS
                    });
                    notified++;
                } catch (err) {
                    errors++;
                    apiLogger.error(
                        {
                            partnerId: partner.id,
                            error: err instanceof Error ? err.message : String(err)
                        },
                        'partner-unpaid-reaper: failed to notify — continuing with the rest'
                    );
                }
            }

            logger.info('partner-unpaid-reaper: tick complete', {
                notified,
                archived,
                errors,
                durationMs: Date.now() - startMs
            });

            return {
                success: errors === 0,
                message: `Notified ${notified}, archived ${archived} unpaid partner(s)${
                    errors > 0 ? `, ${errors} error(s)` : ''
                }`,
                processed: notified + archived,
                errors,
                durationMs: Date.now() - startMs
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error('partner-unpaid-reaper: fatal error', { error: message });
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
