import type { Clock } from '@repo/billing-verticals-contract';
import {
    buildEmailDedupKey,
    buildScheduleOccurrence,
    type DrizzleClient,
    type EnqueueEmailInput,
    emailOutboxModel,
    enqueueOrMergeScheduledEmail,
    users,
    withdrawScheduledEmails
} from '@repo/db';
import { NotificationType } from '@repo/notifications';
import type { TrialCampaignKind, TrialMachineTransaction } from '@repo/verticals';
import {
    marketCalendarDay,
    marketMidnight,
    PRE_EXPIRY_CAMPAIGN_OFFSETS_DAYS,
    RECOVERY_CAMPAIGN_OFFSETS_DAYS
} from '@repo/verticals';
import { eq } from 'drizzle-orm';
import { apiLogger } from '../logger';

/** Tipos de plantilla por campaña y desplazamiento de días. */
export const TRIAL_CAMPAIGN_TEMPLATES: Readonly<
    Record<TrialCampaignKind, Readonly<Record<number, string>>>
> = {
    PRE_EXPIRY: {
        10: NotificationType.TRIAL_ENDING_10D,
        5: NotificationType.TRIAL_ENDING_5D,
        2: NotificationType.TRIAL_ENDING_2D,
        0: NotificationType.TRIAL_ENDING_TODAY
    },
    RECOVERY: {
        1: NotificationType.TRIAL_WIN_BACK_1D,
        5: NotificationType.TRIAL_WIN_BACK_5D,
        15: NotificationType.TRIAL_WIN_BACK_15D,
        30: NotificationType.TRIAL_WIN_BACK_30D,
        60: NotificationType.TRIAL_WIN_BACK_60D
    }
};

/** Returns the stable schedule label for a campaign offset. */
export function TRIAL_CAMPAIGN_MILESTONE(input: {
    readonly campaign: TrialCampaignKind;
    readonly offsetDays: number;
}): string {
    if (input.campaign === 'PRE_EXPIRY')
        return input.offsetDays === 0 ? 'pre:0d' : `pre:-${input.offsetDays}d`;
    return `rec:+${input.offsetDays}d`;
}

/** Transactional dependencies used by the campaign adapter. */
export interface TrialCampaignOutboxDependencies {
    readonly enqueueOrMerge: typeof enqueueOrMergeScheduledEmail;
    readonly enqueue: (input: EnqueueEmailInput, tx: DrizzleClient) => Promise<unknown>;
    readonly withdraw: typeof withdrawScheduledEmails;
    readonly readRecipient: (input: {
        readonly tx: DrizzleClient;
        readonly userId: string;
    }) => Promise<{ readonly email: string | null; readonly displayName: string | null } | null>;
}

/** Input for composing the trial campaign transaction ports. */
export interface BuildTrialCampaignOutboxInput {
    readonly tx: DrizzleClient;
    readonly clock: Clock;
    readonly deps?: Partial<TrialCampaignOutboxDependencies>;
}

function dayString(instant: Date): string {
    const day = marketCalendarDay(instant);
    return `${day.year.toString().padStart(4, '0')}-${day.month.toString().padStart(2, '0')}-${day.day.toString().padStart(2, '0')}`;
}

function productionRecipient(input: { readonly tx: DrizzleClient; readonly userId: string }) {
    return input.tx
        .select({ email: users.email, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1)
        .then((rows) => rows[0] ?? null);
}

/**
 * Builds transaction-bound trial campaign ports that write scheduled rows to
 * the common outbox and withdraw only the current vertical's pending rows.
 *
 * @param input - Domain transaction, shared clock, and optional test dependencies.
 * @returns Campaign methods for a trial machine transaction.
 */
export function buildTrialCampaignOutbox(
    input: BuildTrialCampaignOutboxInput
): Pick<
    TrialMachineTransaction,
    'scheduleExpiryCampaign' | 'scheduleRecoveryCampaign' | 'cancelCampaign'
> {
    const deps: TrialCampaignOutboxDependencies = {
        enqueueOrMerge: input.deps?.enqueueOrMerge ?? enqueueOrMergeScheduledEmail,
        enqueue: input.deps?.enqueue ?? ((mail, tx) => emailOutboxModel.enqueue(mail, tx)),
        withdraw: input.deps?.withdraw ?? withdrawScheduledEmails,
        readRecipient: input.deps?.readRecipient ?? productionRecipient
    };

    async function schedule(inputArgs: {
        readonly userId: string;
        readonly vertical: string;
        readonly campaign: TrialCampaignKind;
        readonly offsets: readonly number[];
        readonly deadlinesVersion: number;
        readonly milestones: readonly Date[];
        readonly withdrawFirst: boolean;
    }): Promise<void> {
        if (inputArgs.milestones.length !== inputArgs.offsets.length) {
            throw new TypeError(
                `${inputArgs.campaign} milestones length does not match deadline offsets`
            );
        }
        const templateMap = TRIAL_CAMPAIGN_TEMPLATES[inputArgs.campaign];
        if (inputArgs.withdrawFirst) {
            await deps.withdraw({
                tx: input.tx,
                recipientUserId: inputArgs.userId,
                templates: Object.values(templateMap),
                vertical: inputArgs.vertical,
                reason: 'trial-rescheduled'
            });
        }
        const recipient = await deps.readRecipient({ tx: input.tx, userId: inputArgs.userId });
        if (!recipient?.email) {
            apiLogger.warn(
                { userId: inputArgs.userId, vertical: inputArgs.vertical },
                'Trial campaign recipient has no email'
            );
            return;
        }
        const today = dayString(input.clock.now());
        for (const [index, milestoneAt] of inputArgs.milestones.entries()) {
            const offsetDays = inputArgs.offsets[index];
            if (offsetDays === undefined) throw new TypeError('Campaign offset is missing');
            const targetDate = dayString(milestoneAt);
            if (targetDate < today) continue;
            const template = templateMap[offsetDays];
            if (!template)
                throw new TypeError(`No ${inputArgs.campaign} template for offset ${offsetDays}`);
            const milestone = TRIAL_CAMPAIGN_MILESTONE({
                campaign: inputArgs.campaign,
                offsetDays
            });
            const sendAfter = marketMidnight(marketCalendarDay(milestoneAt));
            const occurrence = buildScheduleOccurrence({
                subjectKind: 'trialuser',
                subjectId: inputArgs.userId,
                milestone,
                targetDate
            });
            const dedupKey = buildEmailDedupKey({
                recipient: inputArgs.userId,
                template,
                occurrence
            });
            const payload = {
                campaign: inputArgs.campaign,
                milestone,
                offsetDays,
                targetDate,
                recipientName: recipient.displayName,
                deadlinesVersion: inputArgs.deadlinesVersion
            };
            const result = await deps.enqueueOrMerge({
                tx: input.tx,
                recipientUserId: inputArgs.userId,
                recipientEmail: recipient.email,
                template,
                dedupKey,
                sendAfter,
                payload,
                vertical: inputArgs.vertical
            });
            if (result.outcome === 'refused') {
                const fallbackOccurrence = buildScheduleOccurrence({
                    subjectKind: 'trial',
                    subjectId: `${inputArgs.userId}.${inputArgs.vertical}`,
                    milestone,
                    targetDate
                });
                await deps.enqueue(
                    {
                        recipientUserId: inputArgs.userId,
                        recipientEmail: recipient.email,
                        template,
                        dedupKey: buildEmailDedupKey({
                            recipient: inputArgs.userId,
                            template,
                            occurrence: fallbackOccurrence
                        }),
                        payload: { ...payload, verticals: [inputArgs.vertical] },
                        sendAfter
                    },
                    input.tx
                );
            }
        }
    }

    return {
        async scheduleExpiryCampaign(args) {
            await schedule({
                ...args,
                campaign: 'PRE_EXPIRY',
                offsets: PRE_EXPIRY_CAMPAIGN_OFFSETS_DAYS,
                withdrawFirst: true
            });
        },
        async scheduleRecoveryCampaign(args) {
            await schedule({
                ...args,
                campaign: 'RECOVERY',
                offsets: RECOVERY_CAMPAIGN_OFFSETS_DAYS,
                withdrawFirst: false
            });
        },
        async cancelCampaign(args) {
            await deps.withdraw({
                tx: input.tx,
                recipientUserId: args.userId,
                templates: Object.values(TRIAL_CAMPAIGN_TEMPLATES[args.campaign]),
                vertical: args.vertical,
                reason: 'trial-converted'
            });
        }
    };
}
