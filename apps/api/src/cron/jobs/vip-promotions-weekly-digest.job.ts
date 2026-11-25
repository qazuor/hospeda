/**
 * VIP Promotions Weekly Digest Job (HOS-2589 §7.7)
 *
 * Every Monday at 10:00 Buenos Aires time (one hour after the AI questions digest),
 * emails each VIP tourist the promotions that FIRST became active during the
 * previous ART week and are still current, both audiences.
 *
 * Rules this job enforces:
 * - **No empty email** (AC-15): no new promotion in the week, nothing is sent.
 * - **VIP only** (AC-17): candidates from live titles, confirmed through the TOURIST
 *   effective set (`vip_promotions_access`); a failed read skips the candidate.
 * - **Opt-out** (AC-16): `settings.vipPromotionsDigest === false` or
 *   `settings.notifications.allowEmails === false`.
 * - **Idempotent** (AC-18): a sent `notification_log` row with the key
 *   `vip-promotions-digest:<userId>:<weekKey>` skips the recipient.
 * - **New = first activated** (AC-19): `first_activated_at`, never `updatedAt`.
 *
 * @module cron/jobs/vip-promotions-weekly-digest
 */
import type { VipPromotionsWeeklyDigestPayload } from '@repo/notifications';
import type {
    readVipDigestCandidates,
    readWeekPromotions
} from '../../services/vip-promotions-digest.selection.js';
import type { CronJobContext, CronJobDefinition, CronJobResult } from '../types.js';

/** Collaborators of {@link runVipPromotionsWeeklyDigest}, injectable for tests. */
export interface VipPromotionsDigestDeps {
    readonly readPromotions: typeof readWeekPromotions;
    readonly readCandidates: typeof readVipDigestCandidates;
    /** `true` when the user's TOURIST effective set grants `vip_promotions_access`. */
    readonly isVip: (input: { readonly userId: string }) => Promise<boolean>;
    readonly alreadySent: (input: { readonly idempotencyKey: string }) => Promise<boolean>;
    readonly send: (
        payload: VipPromotionsWeeklyDigestPayload
    ) => Promise<{ readonly delivered: boolean }>;
    readonly siteUrl: string;
}

/** Summary of one run. */
export interface VipPromotionsDigestRunOutput {
    readonly promotions: number;
    readonly candidates: number;
    readonly sent: number;
    readonly skippedNotVip: number;
    readonly skippedOptOut: number;
    readonly skippedAlreadySent: number;
    readonly failed: number;
}

/** Builds the production collaborators lazily (DB and env stay out of import time). */
async function buildDefaultDeps(): Promise<VipPromotionsDigestDeps> {
    const [{ getDb, notificationLog }, drizzle, selection, notifications, helper, config, gate] =
        await Promise.all([
            import('@repo/db'),
            import('drizzle-orm'),
            import('../../services/vip-promotions-digest.selection.js'),
            import('@repo/notifications'),
            import('../../utils/notification-helper.js'),
            import('../../utils/env.js'),
            import('../../utils/listing-access/user-gate.js')
        ]);
    const { VerticalEnum } = await import('@repo/schemas');
    const { and, eq, sql } = drizzle;
    return {
        readPromotions: selection.readWeekPromotions,
        readCandidates: selection.readVipDigestCandidates,
        isVip: async ({ userId }) => {
            const keys = await gate.readEffectiveKeys({
                userId,
                vertical: VerticalEnum.TOURIST,
                keys: ['vip_promotions_access']
            });
            return keys.vip_promotions_access === true;
        },
        alreadySent: async ({ idempotencyKey }) => {
            const rows = await getDb()
                .select({ id: notificationLog.id })
                .from(notificationLog)
                .where(
                    and(
                        eq(
                            notificationLog.type,
                            notifications.NotificationType.VIP_PROMOTIONS_WEEKLY_DIGEST
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
        siteUrl: config.env.HOSPEDA_SITE_URL
    };
}

/**
 * Runs one digest pass for the ART week before `now`.
 *
 * @param input - Reference instant and collaborators.
 * @returns Counters for the run.
 */
export async function runVipPromotionsWeeklyDigest(input: {
    readonly now: Date;
    readonly deps: VipPromotionsDigestDeps;
}): Promise<VipPromotionsDigestRunOutput> {
    const helpers = await import('../../services/vip-promotions-digest.helpers.js');
    const { digestWeekKey, digestLocale } = await import(
        '../../services/ai-questions-digest.helpers.js'
    );
    const { NotificationType, buildVipPromotionsDigestSubject } = await import(
        '@repo/notifications'
    );
    const { deps, now } = input;

    const { from, to } = helpers.previousArtWeek({ now });
    const { rows, total } = await deps.readPromotions({
        from,
        to,
        now,
        limit: helpers.VIP_DIGEST_MAX_LISTED
    });
    const listed = rows.filter((row) => row.place !== null);
    if (total === 0 || listed.length === 0) {
        return {
            promotions: 0,
            candidates: 0,
            sent: 0,
            skippedNotVip: 0,
            skippedOptOut: 0,
            skippedAlreadySent: 0,
            failed: 0
        };
    }

    const { weekKey } = digestWeekKey({ windowEnd: to });
    const { recipients } = await deps.readCandidates();
    const base = deps.siteUrl.replace(/\/+$/, '');

    let sent = 0;
    let skippedNotVip = 0;
    let skippedOptOut = 0;
    let skippedAlreadySent = 0;
    let failed = 0;

    for (const recipient of recipients) {
        if (!helpers.acceptsVipDigest({ settings: recipient.settings }).accepts) {
            skippedOptOut++;
            continue;
        }
        if (!(await deps.isVip({ userId: recipient.id }))) {
            skippedNotVip++;
            continue;
        }
        const idempotencyKey = `vip-promotions-digest:${recipient.id}:${weekKey}`;
        if (await deps.alreadySent({ idempotencyKey })) {
            skippedAlreadySent++;
            continue;
        }
        const { locale } = digestLocale({ settings: recipient.settings });
        const outcome = await deps.send({
            type: NotificationType.VIP_PROMOTIONS_WEEKLY_DIGEST,
            recipientEmail: recipient.email,
            recipientName: recipient.name,
            userId: recipient.id,
            idempotencyKey,
            locale,
            digestSubject: buildVipPromotionsDigestSubject({ locale, total }).subject,
            promotions: listed.map(({ promotion, place }) => ({
                title: promotion.title,
                benefit: helpers.formatDigestBenefit({
                    discountType: promotion.discountType,
                    discountValue: promotion.discountValue,
                    description: promotion.description ?? null,
                    title: promotion.title,
                    locale
                }),
                placeName: place?.name ?? '',
                placeUrl: helpers.buildPlaceUrl({
                    siteUrl: deps.siteUrl,
                    locale,
                    entityType: promotion.entityType,
                    slug: place?.slug ?? ''
                }).url,
                vipOnly: promotion.touristAudience === 'vip',
                startsLabel: helpers.formatStartsLabel({
                    validFrom: new Date(promotion.validFrom),
                    now,
                    locale
                })
            })),
            moreCount: Math.max(0, total - listed.length),
            promotionsUrl: `${base}/${locale}/promociones/`,
            preferencesUrl: `${base}/${locale}/mi-cuenta/preferencias/`
        });
        if (outcome.delivered) sent++;
        else failed++;
    }

    return {
        promotions: total,
        candidates: recipients.length,
        sent,
        skippedNotVip,
        skippedOptOut,
        skippedAlreadySent,
        failed
    };
}

/** Builds the job result. */
function toResult(ctx: CronJobContext, output: VipPromotionsDigestRunOutput): CronJobResult {
    return {
        success: true,
        message: `VIP promotions digest: ${output.promotions} new, ${output.sent} sent, ${output.skippedNotVip} not VIP, ${output.skippedOptOut} opted out, ${output.skippedAlreadySent} already sent, ${output.failed} failed`,
        processed: output.sent,
        errors: output.failed,
        durationMs: Date.now() - ctx.startedAt.getTime(),
        details: { ...output }
    };
}

/** Job definition. */
export const vipPromotionsWeeklyDigestJob: CronJobDefinition = {
    name: 'vip-promotions-weekly-digest',
    description:
        "Weekly email to VIP tourists with the previous week's newly activated promotions (HOS-2589)",
    schedule: '0 10 * * 1',
    enabled: true,
    timeoutMs: 300_000,

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;
        if (dryRun) {
            logger.info('Dry run mode - skipping VIP promotions digest');
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
            const output = await runVipPromotionsWeeklyDigest({
                now: startedAt,
                deps: await buildDefaultDeps()
            });
            logger.info('VIP promotions digest completed', { ...output });
            return toResult(ctx, output);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('VIP promotions digest failed', { error: errorMessage });
            return {
                success: false,
                message: `VIP promotions digest failed: ${errorMessage}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: errorMessage }
            };
        }
    }
};
