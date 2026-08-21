/**
 * Lead Intake Backstop Cron Job (H-62 / H-148)
 *
 * ## What it is for
 *
 * The intake alert now fires the moment a lead is submitted, and it is
 * fire-and-forget by design: it must never cost an applicant their submission.
 * That design has a consequence — a mail provider having a bad minute, an API
 * restart mid-request, or an unset address list all end with a lead in the
 * database that nobody was told about, and with no complaint from anyone,
 * because nobody knows they did not find out.
 *
 * This job closes that. It looks for leads that are still waiting on a human
 * AND were never announced, and sends each one the SAME alert the intake path
 * would have sent — the identical function, so the two can never drift into
 * describing the same lead differently. One email per lead rather than a
 * digest, because the recipient's next action is per lead and because reusing
 * the intake path is what keeps `ops_notified_at` written by exactly one piece
 * of code.
 *
 * Re-sending is bounded by that same column: a lead announced here is stamped,
 * so the next tick does not see it. A lead whose send fails stays null and is
 * retried — which is the intended behaviour, and the reason the batch is
 * capped.
 *
 * ## Why "never announced" is a column and not a heuristic
 *
 * `ops_notified_at` is written on CONFIRMED delivery and on nothing else. The
 * alternative — inferring it from `billing_notification_log` — looks equivalent
 * and is not: that table is purged on a schedule, so an old lead would drift
 * back into "never announced" and be re-sent forever.
 *
 * ## Why it only chases unresolved leads
 *
 * A lead already `approved` or `rejected` was plainly seen by somebody, whatever
 * the column says. Alerting on it would be telling an operator about work they
 * already did. Its `ops_notified_at` stays null, which is the honest record: we
 * never did alert on it.
 *
 * ## Why this job is alliance-only now (HOS-693)
 *
 * This job originally backstopped both the commerce and the alliance intake
 * funnels. Commerce lead intake was retired (its public form and admin
 * provisioning flow are gone), so this job was narrowed to alliance leads only
 * — leaving the commerce query in place would eventually throw once
 * `commerce_leads` itself is dropped, and it shared a `Promise.all` with the
 * alliance query, so that throw would have taken the alliance backstop down
 * with it.
 *
 * @module cron/jobs/lead-intake-backstop
 */

import { allianceLeads, getDb } from '@repo/db';
import { and, asc, inArray, isNull } from 'drizzle-orm';
import { announceLeadToOps, type LeadIntakeAlert } from '../../lib/lead-intake-ports.js';
import type { CronJobDefinition, CronJobResult } from '../types.js';

/**
 * Lead statuses that still need a human.
 *
 * `alliance_leads.status` uses the same workflow vocabulary the commerce
 * funnel's backstop used to check — see the schema comment on
 * `alliance_leads.status`, which mirrors `commerce_leads.status` even though
 * this job no longer queries the latter (HOS-693: commerce lead intake was
 * retired, so this job now covers alliance leads only).
 */
const UNRESOLVED_STATUSES = ['pending', 'reviewing'] as const;

/**
 * Ceiling per tick.
 *
 * Bounded because the first production run has a backlog to work through — the
 * column starts null for every lead that predates it — and an unbounded first
 * tick would try to announce all of them at once.
 */
const BATCH_LIMIT = 50;

/** Human labels for the four "aliados" programs, mirroring the intake port. */
const ALLIANCE_PROGRAM_LABELS: Readonly<Record<string, string>> = {
    partner: 'Partner',
    sponsor: 'Sponsor',
    editor: 'Editor',
    service_provider: 'Proveedor'
};

/**
 * Finds alliance leads still waiting on a human that nobody was told about.
 *
 * Soft-deleted rows are excluded: `alliance_leads` carries the full audit
 * convention, and a deleted application is not work anybody owes an answer to.
 *
 * @returns Normalised alerts, oldest first.
 */
async function findUnannouncedAllianceLeads(): Promise<readonly LeadIntakeAlert[]> {
    const db = getDb();
    const rows = await db
        .select()
        .from(allianceLeads)
        .where(
            and(
                isNull(allianceLeads.opsNotifiedAt),
                isNull(allianceLeads.deletedAt),
                inArray(allianceLeads.status, [...UNRESOLVED_STATUSES])
            )
        )
        .orderBy(asc(allianceLeads.createdAt))
        .limit(BATCH_LIMIT);

    return rows.map((row) => ({
        funnel: 'alliance' as const,
        leadId: row.id,
        programLabel: ALLIANCE_PROGRAM_LABELS[row.kind] ?? row.kind,
        contactName: row.contactName,
        contactEmail: row.email,
        contactPhone: row.phone,
        businessName: row.businessName,
        message: row.message,
        createdAt: row.createdAt
    }));
}

export const leadIntakeBackstopJob: CronJobDefinition = {
    name: 'lead-intake-backstop',
    description:
        'Announce acquisition leads that are still unresolved and were never announced to ops (H-62 / H-148).',
    // Every four hours rather than daily: the value of a lead alert decays fast,
    // and this is the only thing standing between a dropped send and a lead
    // nobody ever reads.
    schedule: '20 */4 * * *',
    enabled: true,
    timeoutMs: 120_000,

    handler: async (ctx): Promise<CronJobResult> => {
        const { logger, startedAt, dryRun } = ctx;
        const startMs = startedAt.getTime();

        logger.info('lead-intake-backstop: starting tick', {
            dryRun,
            startedAt: startedAt.toISOString()
        });

        try {
            const alliance = await findUnannouncedAllianceLeads();

            const pending = alliance;

            if (pending.length === 0) {
                return {
                    success: true,
                    message: 'lead-intake-backstop: every lead has been announced',
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startMs,
                    details: { alliance: 0 }
                };
            }

            logger.warn('lead-intake-backstop: found leads nobody was told about', {
                alliance: alliance.length,
                oldest: pending[0]?.createdAt.toISOString()
            });

            if (dryRun) {
                return {
                    success: true,
                    message: `lead-intake-backstop: would announce ${pending.length} lead(s)`,
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startMs,
                    details: {
                        alliance: alliance.length,
                        dryRun: true
                    }
                };
            }

            // Sequential, not parallel: these go to the same mailbox through the
            // same provider, and a burst is the shape rate limiters punish. A
            // send that fails leaves its row's `ops_notified_at` null, so the
            // next tick retries exactly it.
            let announced = 0;
            let failed = 0;
            for (const alert of pending) {
                const { delivered } = await announceLeadToOps({ alert });
                if (delivered) {
                    announced += 1;
                } else {
                    failed += 1;
                }
            }

            return {
                success: failed === 0,
                message: `lead-intake-backstop: announced ${announced} lead(s), ${failed} still undelivered`,
                processed: announced,
                errors: failed,
                durationMs: Date.now() - startMs,
                details: {
                    alliance: alliance.length,
                    announced,
                    failed
                }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('lead-intake-backstop: tick failed', { error: message });

            return {
                success: false,
                message: `lead-intake-backstop: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startMs
            };
        }
    }
};
