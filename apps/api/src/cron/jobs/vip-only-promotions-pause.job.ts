/**
 * VIP-only Promotions Pause Job (HOS-2589 D-8, AC-35..AC-39)
 *
 * Hourly sweep: every ACTIVE «Solo VIP» promotion whose owner no longer holds
 * `vip_only_promotions` in the promotion's vertical is PAUSED (ACTIVE → INACTIVE
 * with `vip_paused_at`), never deleted nor converted to «Para todos». The owner
 * gets one email per pause listing the paused titles; the in-app notice is the
 * `vipPausedAt` stamp the Mi cuenta promotions page reads.
 *
 * Safety:
 * - The key is read with the THROWING probe: an effective-set outage pauses
 *   nothing for that owner (counted as an error), it never reads as «lost».
 * - The pause only touches rows still ACTIVE and `vip`, and the email lists only
 *   the ids that call actually paused, so a second run changes and sends nothing
 *   (AC-39).
 *
 * @module cron/jobs/vip-only-promotions-pause
 */
import type { ActiveVipPromotionRow } from '@repo/db';
import type { VipPromotionsPausedPayload } from '@repo/notifications';
import type { VerticalEnum } from '@repo/schemas';
import type { CronJobContext, CronJobDefinition, CronJobResult } from '../types.js';

/** One owner's recipient data. */
export interface PauseRecipient {
    readonly id: string;
    readonly email: string;
    readonly name: string;
    readonly settings: unknown;
}

/** Collaborators of {@link runVipOnlyPromotionsPause}, injectable for tests. */
export interface VipOnlyPauseDeps {
    readonly findActiveVipPromotions: () => Promise<readonly ActiveVipPromotionRow[]>;
    /** Throws when the effective set cannot be read. */
    readonly holdsVipOnlyKey: (input: {
        readonly userId: string;
        readonly vertical: VerticalEnum;
    }) => Promise<boolean>;
    readonly pause: (input: {
        readonly ids: readonly string[];
        readonly now: Date;
    }) => Promise<readonly string[]>;
    readonly readRecipients: (input: {
        readonly ids: readonly string[];
    }) => Promise<readonly PauseRecipient[]>;
    readonly send: (
        payload: VipPromotionsPausedPayload
    ) => Promise<{ readonly delivered: boolean }>;
    readonly siteUrl: string;
}

/** Summary of one run. */
export interface VipOnlyPauseRunOutput {
    readonly checkedOwners: number;
    readonly paused: number;
    readonly notified: number;
    readonly readErrors: number;
    readonly failedNotices: number;
}

/** Builds the production collaborators lazily. */
async function buildDefaultDeps(): Promise<VipOnlyPauseDeps> {
    const [db, drizzle, helper, config, gate] = await Promise.all([
        import('@repo/db'),
        import('drizzle-orm'),
        import('../../utils/notification-helper.js'),
        import('../../utils/env.js'),
        import('../../utils/listing-access/user-gate.js')
    ]);
    const { and, inArray, isNull } = drizzle;
    return {
        findActiveVipPromotions: () => db.ownerPromotionTouristModel.findActiveVipPromotions(),
        holdsVipOnlyKey: async ({ userId, vertical }) => {
            const keys = await gate.probeEffectiveKeys({
                userId,
                vertical,
                keys: ['vip_only_promotions']
            });
            return keys.vip_only_promotions === true;
        },
        pause: ({ ids, now }) => db.ownerPromotionTouristModel.pauseVipPromotions({ ids, now }),
        readRecipients: async ({ ids }) => {
            if (ids.length === 0) return [];
            const rows = await db
                .getDb()
                .select({
                    id: db.users.id,
                    email: db.users.email,
                    displayName: db.users.displayName,
                    firstName: db.users.firstName,
                    settings: db.users.settings
                })
                .from(db.users)
                .where(and(inArray(db.users.id, [...ids]), isNull(db.users.deletedAt)));
            return rows.map((row) => ({
                id: row.id,
                email: row.email,
                name: row.firstName ?? row.displayName ?? '',
                settings: row.settings
            }));
        },
        send: (payload) => helper.trySendNotification(payload),
        siteUrl: config.env.HOSPEDA_SITE_URL
    };
}

/**
 * Runs one pause sweep.
 *
 * @param input - Reference instant and collaborators.
 * @returns Counters for the run.
 */
export async function runVipOnlyPromotionsPause(input: {
    readonly now: Date;
    readonly deps: VipOnlyPauseDeps;
}): Promise<VipOnlyPauseRunOutput> {
    const { NotificationType, buildVipPromotionsPausedSubject } = await import(
        '@repo/notifications'
    );
    const { digestLocale } = await import('../../services/ai-questions-digest.helpers.js');
    const { VerticalEnum } = await import('@repo/schemas');
    // A Record keyed by every promotion entity type: a new one fails to compile here.
    const VERTICAL_BY_ENTITY_TYPE: Readonly<
        Record<ActiveVipPromotionRow['entityType'], VerticalEnum>
    > = {
        accommodation: VerticalEnum.ACCOMMODATION,
        venue: VerticalEnum.VENUE
    };
    const { deps, now } = input;

    const active = await deps.findActiveVipPromotions();
    const byOwnerVertical = new Map<string, ActiveVipPromotionRow[]>();
    for (const row of active) {
        const key = `${row.ownerId}|${row.entityType}`;
        byOwnerVertical.set(key, [...(byOwnerVertical.get(key) ?? []), row]);
    }

    let readErrors = 0;
    const pausedByOwner = new Map<string, string[]>();
    for (const [key, rows] of byOwnerVertical) {
        const [ownerId = ''] = key.split('|');
        const vertical = VERTICAL_BY_ENTITY_TYPE[rows[0]?.entityType ?? 'accommodation'];
        let holds: boolean;
        try {
            holds = await deps.holdsVipOnlyKey({ userId: ownerId, vertical });
        } catch {
            readErrors++;
            continue;
        }
        if (holds) continue;
        const pausedIds = new Set(await deps.pause({ ids: rows.map((row) => row.id), now }));
        const titles = rows.filter((row) => pausedIds.has(row.id)).map((row) => row.title);
        if (titles.length > 0) {
            pausedByOwner.set(ownerId, [...(pausedByOwner.get(ownerId) ?? []), ...titles]);
        }
    }

    const recipients = await deps.readRecipients({ ids: [...pausedByOwner.keys()] });
    const base = deps.siteUrl.replace(/\/+$/, '');
    let notified = 0;
    let failedNotices = 0;
    for (const recipient of recipients) {
        const titles = pausedByOwner.get(recipient.id) ?? [];
        if (titles.length === 0) continue;
        const { locale } = digestLocale({ settings: recipient.settings });
        const outcome = await deps.send({
            type: NotificationType.VIP_PROMOTIONS_PAUSED,
            recipientEmail: recipient.email,
            recipientName: recipient.name,
            userId: recipient.id,
            idempotencyKey: `vip-promotions-paused:${recipient.id}:${now.toISOString()}`,
            locale,
            pausedSubject: buildVipPromotionsPausedSubject({ locale, count: titles.length })
                .subject,
            promotionTitles: titles,
            promotionsUrl: `${base}/${locale}/mi-cuenta/promociones/`
        });
        if (outcome.delivered) notified++;
        else failedNotices++;
    }

    return {
        checkedOwners: byOwnerVertical.size,
        paused: [...pausedByOwner.values()].reduce((sum, titles) => sum + titles.length, 0),
        notified,
        readErrors,
        failedNotices
    };
}

/** Builds the job result. */
function toResult(ctx: CronJobContext, output: VipOnlyPauseRunOutput): CronJobResult {
    return {
        success: true,
        message: `VIP-only promotions pause: ${output.paused} paused, ${output.notified} owners notified, ${output.readErrors} read errors, ${output.failedNotices} failed notices`,
        processed: output.paused,
        errors: output.readErrors + output.failedNotices,
        durationMs: Date.now() - ctx.startedAt.getTime(),
        details: { ...output }
    };
}

/** Job definition. */
export const vipOnlyPromotionsPauseJob: CronJobDefinition = {
    name: 'vip-only-promotions-pause',
    description:
        'Pause «Solo VIP» promotions whose owner lost vip_only_promotions and tell the owner (HOS-2589 D-8)',
    schedule: '20 * * * *',
    enabled: true,
    timeoutMs: 300_000,

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;
        if (dryRun) {
            logger.info('Dry run mode - skipping VIP-only promotions pause');
            return {
                success: true,
                message: 'Dry run - nothing paused',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }
        try {
            const output = await runVipOnlyPromotionsPause({
                now: startedAt,
                deps: await buildDefaultDeps()
            });
            logger.info('VIP-only promotions pause completed', { ...output });
            return toResult(ctx, output);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('VIP-only promotions pause failed', { error: errorMessage });
            return {
                success: false,
                message: `VIP-only promotions pause failed: ${errorMessage}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: errorMessage }
            };
        }
    }
};
