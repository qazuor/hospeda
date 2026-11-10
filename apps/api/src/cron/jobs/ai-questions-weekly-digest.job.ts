/**
 * AI Questions Weekly Digest Job (HOS-2101)
 *
 * Every Monday at 9:00 Buenos Aires time, emails each listing owner the AI chat
 * questions their listings could not answer during the previous 7 days, with a
 * link per listing to its «Preguntas a la IA» tab.
 *
 * Owner decisions this job enforces:
 * - **No email on an empty week.** Owners are only produced from unanswered rows
 *   (`groupDigestRows`), so an owner with none is never considered.
 * - **Opt-out.** `settings.aiQuestionsDigest === false` or
 *   `settings.notifications.allowEmails === false` skips the owner.
 * - **es / en / pt** from the owner's `languageWeb`.
 * - **Anonymous.** The email quotes questions, never who asked.
 *
 * Idempotent per owner and week: a `notification_log` row with the key
 * `ai-questions-digest:<userId>:<weekKey>` and status `sent` skips the owner, so
 * a manual re-run in the same week sends nothing twice.
 *
 * @module cron/jobs/ai-questions-weekly-digest
 */

import type { AiQuestionsWeeklyDigestPayload } from '@repo/notifications';
import type {
    readDigestRecipients,
    readDigestRows
} from '../../services/ai-questions-digest.selection.js';
import type { CronJobContext, CronJobDefinition, CronJobResult } from '../types.js';

/** Collaborators of {@link runAiQuestionsWeeklyDigest}, injectable for tests. */
export interface AiQuestionsDigestDeps {
    readonly readRows: typeof readDigestRows;
    readonly readRecipients: typeof readDigestRecipients;
    readonly alreadySent: (input: { readonly idempotencyKey: string }) => Promise<boolean>;
    readonly send: (
        payload: AiQuestionsWeeklyDigestPayload
    ) => Promise<{ readonly delivered: boolean }>;
    readonly siteUrl: string;
}

/** Summary of one run. */
export interface AiQuestionsDigestRunOutput {
    readonly owners: number;
    readonly sent: number;
    readonly skippedOptOut: number;
    readonly skippedAlreadySent: number;
    readonly failed: number;
}

/** Builds the production collaborators lazily (DB and env stay out of import time). */
async function buildDefaultDeps(): Promise<AiQuestionsDigestDeps> {
    const [{ getDb, notificationLog }, drizzle, selection, notifications, helper, envModule] =
        await Promise.all([
            import('@repo/db'),
            import('drizzle-orm'),
            import('../../services/ai-questions-digest.selection.js'),
            import('@repo/notifications'),
            import('../../utils/notification-helper.js'),
            import('../../utils/env.js')
        ]);
    const { and, eq, sql } = drizzle;
    return {
        readRows: selection.readDigestRows,
        readRecipients: selection.readDigestRecipients,
        alreadySent: async ({ idempotencyKey }) => {
            const rows = await getDb()
                .select({ id: notificationLog.id })
                .from(notificationLog)
                .where(
                    and(
                        eq(
                            notificationLog.type,
                            notifications.NotificationType.AI_QUESTIONS_WEEKLY_DIGEST
                        ),
                        eq(notificationLog.status, 'sent'),
                        eq(
                            sql<string>`${notificationLog.metadata}->>'idempotencyKey'`,
                            idempotencyKey
                        )
                    )
                )
                .limit(1);
            return rows.length > 0;
        },
        send: (payload) => helper.trySendNotification(payload),
        siteUrl: envModule.env.HOSPEDA_SITE_URL
    };
}

/**
 * Runs one digest pass over the window ending at `now`.
 *
 * @param input - Reference instant and collaborators.
 * @returns Counters for the run.
 */
export async function runAiQuestionsWeeklyDigest(input: {
    readonly now: Date;
    readonly deps: AiQuestionsDigestDeps;
}): Promise<AiQuestionsDigestRunOutput> {
    const selection = await import('../../services/ai-questions-digest.helpers.js');
    const { NotificationType, buildAiQuestionsDigestSubject } = await import('@repo/notifications');
    const { deps } = input;

    const windowEnd = input.now;
    const windowStart = new Date(windowEnd.getTime() - selection.DIGEST_WINDOW_DAYS * 86_400_000);
    const { weekKey } = selection.digestWeekKey({ windowEnd });

    const { rows } = await deps.readRows({ windowStart, windowEnd });
    const { digests } = selection.groupDigestRows({ rows });
    const { recipients } = await deps.readRecipients({
        ownerIds: digests.map((digest) => digest.ownerId)
    });
    const recipientById = new Map(recipients.map((recipient) => [recipient.id, recipient]));

    let sent = 0;
    let skippedOptOut = 0;
    let skippedAlreadySent = 0;
    let failed = 0;

    for (const digest of digests) {
        const recipient = recipientById.get(digest.ownerId);
        if (!recipient || !selection.acceptsDigest({ settings: recipient.settings }).accepts) {
            skippedOptOut++;
            continue;
        }
        const idempotencyKey = `ai-questions-digest:${recipient.id}:${weekKey}`;
        if (await deps.alreadySent({ idempotencyKey })) {
            skippedAlreadySent++;
            continue;
        }
        const { locale } = selection.digestLocale({ settings: recipient.settings });
        const base = deps.siteUrl.replace(/\/+$/, '');
        const outcome = await deps.send({
            type: NotificationType.AI_QUESTIONS_WEEKLY_DIGEST,
            recipientEmail: recipient.email,
            recipientName: recipient.name,
            userId: recipient.id,
            idempotencyKey,
            locale,
            digestSubject: buildAiQuestionsDigestSubject({
                locale,
                totalUnanswered: digest.totalUnanswered
            }).subject,
            preferencesUrl: `${base}/${locale}/mi-cuenta/preferencias/`,
            listings: digest.listings.map((listing) => ({
                listingName: listing.listingName,
                unansweredCount: listing.unansweredCount,
                questions: listing.questions,
                panelUrl: selection.buildPanelUrl({
                    siteUrl: deps.siteUrl,
                    locale,
                    entityType: listing.entityType,
                    entityId: listing.entityId
                }).url
            }))
        });
        if (outcome.delivered) {
            sent++;
        } else {
            failed++;
        }
    }

    return { owners: digests.length, sent, skippedOptOut, skippedAlreadySent, failed };
}

/** Builds the job result. */
function toResult(ctx: CronJobContext, output: AiQuestionsDigestRunOutput): CronJobResult {
    return {
        success: true,
        message: `AI questions digest: ${output.sent} sent, ${output.skippedOptOut} opted out, ${output.skippedAlreadySent} already sent, ${output.failed} failed`,
        processed: output.sent,
        errors: output.failed,
        durationMs: Date.now() - ctx.startedAt.getTime(),
        details: { ...output }
    };
}

/** Job definition. */
export const aiQuestionsWeeklyDigestJob: CronJobDefinition = {
    name: 'ai-questions-weekly-digest',
    description:
        "Weekly email to listing owners with the week's AI chat questions their listings could not answer (HOS-2101)",
    schedule: '0 9 * * 1',
    enabled: true,
    timeoutMs: 300_000,

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;
        if (dryRun) {
            logger.info('Dry run mode - skipping AI questions digest');
            return {
                success: true,
                message: 'Dry run - no digest sent',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }
        try {
            const output = await runAiQuestionsWeeklyDigest({
                now: startedAt,
                deps: await buildDefaultDeps()
            });
            logger.info('AI questions digest completed', { ...output });
            return toResult(ctx, output);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('AI questions digest failed', { error: errorMessage });
            return {
                success: false,
                message: `AI questions digest failed: ${errorMessage}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: errorMessage }
            };
        }
    }
};
