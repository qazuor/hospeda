import {
    buildEmailDedupKey,
    buildScheduleOccurrence,
    type DrizzleClient,
    emailOutboxModel
} from '@repo/db';
import { z } from 'zod';

/** First notice sent when a plan migration is announced. */
export const PLAN_MIGRATION_ANNOUNCED_TEMPLATE = 'billing.plan-migration-announced';
/** Reminder notice sent before a customer's application date. */
export const PLAN_MIGRATION_UPCOMING_TEMPLATE = 'billing.plan-migration-upcoming';
/** Notice sent when an announced migration is cancelled. */
export const PLAN_MIGRATION_CANCELLED_TEMPLATE = 'billing.plan-migration-cancelled';

const templateSchema = z.enum([
    PLAN_MIGRATION_ANNOUNCED_TEMPLATE,
    PLAN_MIGRATION_UPCOMING_TEMPLATE,
    PLAN_MIGRATION_CANCELLED_TEMPLATE
]);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const noticePayloadSchema = z.strictObject({
    planMigrationId: z.string().uuid(),
    planMigrationSubscriptionId: z.string().uuid(),
    subscriptionId: z.string().uuid(),
    vertical: z.string().min(1),
    planName: z.string().min(1),
    targetPlanName: z.string().min(1),
    direction: z.enum(['UP', 'DOWN']),
    currentAmountMinor: z.number().int().nonnegative(),
    newAmountMinor: z.number().int().nonnegative().nullable(),
    currency: z.string().min(1),
    applicationDate: dateSchema.nullable(),
    daysBefore: z.number().int().positive().optional(),
    losesPromo: z.boolean(),
    variant: z.enum(['SCHEDULED', 'WAITING', 'TO_RESOLVE', 'NOTHING_CHANGES', 'ALREADY_STARTED']),
    deadlinesVersion: z.number().int().positive()
});

/** Build a stable key from the scope row and the day the notice concerns. */
export function planMigrationNoticeDedupKey(args: {
    readonly recipientUserId: string;
    readonly template: z.infer<typeof templateSchema>;
    readonly planMigrationSubscriptionId: string;
    readonly milestone: string;
    readonly targetDate: string;
}): string {
    const parsed = z
        .strictObject({
            recipientUserId: z.string().min(1),
            template: templateSchema,
            planMigrationSubscriptionId: z.string().uuid(),
            milestone: z.string().min(1),
            targetDate: dateSchema
        })
        .parse(args);
    return buildEmailDedupKey({
        recipient: parsed.recipientUserId,
        template: parsed.template,
        occurrence: buildScheduleOccurrence({
            subjectKind: 'pms',
            subjectId: parsed.planMigrationSubscriptionId,
            milestone: parsed.milestone,
            targetDate: parsed.targetDate
        })
    });
}

/** Queue a migration notice inside the transaction that writes its domain state. */
export async function enqueuePlanMigrationNotice(args: {
    readonly tx: DrizzleClient;
    readonly template: z.infer<typeof templateSchema>;
    readonly row: {
        readonly id: string;
        readonly recipientUserId: string;
        readonly recipientEmail: string;
    };
    readonly milestone: string;
    readonly targetDate: string;
    readonly payload: z.infer<typeof noticePayloadSchema>;
}): Promise<{ readonly enqueued: boolean }> {
    const payload = noticePayloadSchema.parse(args.payload);
    const queued = await emailOutboxModel.enqueue(
        {
            recipientUserId: args.row.recipientUserId,
            recipientEmail: args.row.recipientEmail,
            template: templateSchema.parse(args.template),
            payload,
            dedupKey: planMigrationNoticeDedupKey({
                recipientUserId: args.row.recipientUserId,
                template: args.template,
                planMigrationSubscriptionId: args.row.id,
                milestone: args.milestone,
                targetDate: args.targetDate
            })
        },
        args.tx
    );
    return { enqueued: queued.enqueued };
}
