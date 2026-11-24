import type { EmailOutboxRow } from '@repo/db';
import { z } from 'zod';
import {
    PLAN_MIGRATION_ANNOUNCED_SUBJECT,
    PLAN_MIGRATION_INCREASE_ANNOUNCED_SUBJECT,
    PlanMigrationAnnounced
} from '../../templates/billing/plan-migration-announced.js';
import {
    PLAN_MIGRATION_CANCELLED_SUBJECT,
    PLAN_MIGRATION_INCREASE_CANCELLED_SUBJECT,
    PlanMigrationCancelled
} from '../../templates/billing/plan-migration-cancelled.js';
import {
    PLAN_MIGRATION_INCREASE_UPCOMING_SUBJECT,
    PLAN_MIGRATION_UPCOMING_SUBJECT,
    PlanMigrationUpcoming
} from '../../templates/billing/plan-migration-upcoming.js';
import { formatCurrency } from '../../templates/utils/index.js';
import { CONTACT_PATH, SUBSCRIPTION_PATH } from './account-listing-paths.js';
import type { OutboxMailRenderer } from './email-outbox-delivery.service.js';

const nonEmptyString = z.string().refine((value) => value.trim() !== '');
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const amountMinor = z.number().int().nonnegative();
const reasonSchema = z.enum(['RETIREMENT', 'PRICE_INCREASE']).optional();
const migrationDetailsSchema = z.object({
    planName: nonEmptyString,
    targetPlanName: nonEmptyString,
    direction: z.enum(['UP', 'DOWN']),
    losesPromo: z.boolean(),
    /** Absent on rows queued before HOS-2608; absent means false. */
    keepsPromo: z.boolean().optional(),
    currentAmountMinor: amountMinor,
    newAmountMinor: amountMinor,
    currency: nonEmptyString,
    reason: reasonSchema
});

const announcedSchema = z.discriminatedUnion('variant', [
    migrationDetailsSchema.extend({ variant: z.literal('SCHEDULED'), applicationDate: dateString }),
    migrationDetailsSchema.extend({ variant: z.literal('WAITING') }),
    z.object({ variant: z.literal('TO_RESOLVE'), planName: nonEmptyString, reason: reasonSchema })
]);
const upcomingSchema = migrationDetailsSchema.extend({
    applicationDate: dateString,
    daysBefore: z.number().int().positive(),
    providerNotifies: z.boolean().optional()
});
const cancelledSchema = z.discriminatedUnion('variant', [
    z.object({
        variant: z.literal('NOTHING_CHANGES'),
        planName: nonEmptyString,
        reason: reasonSchema
    }),
    z.object({
        variant: z.literal('ALREADY_STARTED'),
        planName: nonEmptyString,
        applicationDate: dateString,
        newAmountMinor: amountMinor,
        currency: nonEmptyString,
        reason: reasonSchema
    })
]);

type MigrationDetailsPayload = z.infer<typeof migrationDetailsSchema>;

function migrationAmounts(data: MigrationDetailsPayload) {
    return {
        current: formatCurrency({ amount: data.currentAmountMinor, currency: data.currency }),
        next: formatCurrency({ amount: data.newAmountMinor, currency: data.currency })
    };
}

function announced(row: EmailOutboxRow, actionUrl: string, contactUrl: string) {
    const parsed = announcedSchema.safeParse(row.payload);
    if (!parsed.success) throw new TypeError('Faltan datos requeridos del anuncio de migración');
    const data = parsed.data;
    const amounts = data.variant === 'TO_RESOLVE' ? null : migrationAmounts(data);
    const reason = data.reason ?? 'RETIREMENT';
    return {
        subject:
            reason === 'PRICE_INCREASE'
                ? PLAN_MIGRATION_INCREASE_ANNOUNCED_SUBJECT
                : PLAN_MIGRATION_ANNOUNCED_SUBJECT,
        react: (
            <PlanMigrationAnnounced
                variant={data.variant}
                planName={data.planName}
                targetPlanName={data.variant === 'TO_RESOLVE' ? '' : data.targetPlanName}
                direction={data.variant === 'TO_RESOLVE' ? 'UP' : data.direction}
                currentAmount={amounts?.current ?? ''}
                newAmount={amounts?.next ?? null}
                applicationDate={data.variant === 'SCHEDULED' ? data.applicationDate : null}
                losesPromo={data.variant === 'TO_RESOLVE' ? false : data.losesPromo}
                keepsPromo={data.variant === 'TO_RESOLVE' ? false : (data.keepsPromo ?? false)}
                reason={reason}
                actionUrl={actionUrl}
                contactUrl={contactUrl}
            />
        )
    };
}

function upcoming(row: EmailOutboxRow) {
    const parsed = upcomingSchema.safeParse(row.payload);
    if (!parsed.success)
        throw new TypeError('Faltan datos requeridos del recordatorio de migración');
    const data = parsed.data;
    const amounts = migrationAmounts(data);
    const reason = data.reason ?? 'RETIREMENT';
    return {
        subject:
            reason === 'PRICE_INCREASE'
                ? PLAN_MIGRATION_INCREASE_UPCOMING_SUBJECT
                : PLAN_MIGRATION_UPCOMING_SUBJECT,
        react: (
            <PlanMigrationUpcoming
                daysBefore={data.daysBefore}
                planName={data.planName}
                targetPlanName={data.targetPlanName}
                direction={data.direction}
                currentAmount={amounts.current}
                newAmount={amounts.next}
                applicationDate={data.applicationDate}
                losesPromo={data.losesPromo}
                keepsPromo={data.keepsPromo ?? false}
                providerNotifies={data.providerNotifies ?? false}
                reason={reason}
            />
        )
    };
}

function cancelled(row: EmailOutboxRow) {
    const parsed = cancelledSchema.safeParse(row.payload);
    if (!parsed.success)
        throw new TypeError('Faltan datos requeridos de la cancelación de migración');
    const data = parsed.data;
    const reason = data.reason ?? 'RETIREMENT';
    return {
        subject:
            reason === 'PRICE_INCREASE'
                ? PLAN_MIGRATION_INCREASE_CANCELLED_SUBJECT
                : PLAN_MIGRATION_CANCELLED_SUBJECT,
        react: (
            <PlanMigrationCancelled
                variant={data.variant}
                planName={data.planName}
                newAmount={
                    data.variant === 'ALREADY_STARTED'
                        ? formatCurrency({ amount: data.newAmountMinor, currency: data.currency })
                        : null
                }
                applicationDate={data.variant === 'ALREADY_STARTED' ? data.applicationDate : null}
                reason={reason}
            />
        )
    };
}

/** Builds renderers for plan migration notices in the shared email outbox. */
export function createBillingPlanMigrationRenderers(input: {
    readonly siteUrl: string;
}): Readonly<Record<string, OutboxMailRenderer>> {
    const site = input.siteUrl.replace(/\/$/, '');
    const actionUrl = `${site}${SUBSCRIPTION_PATH}`;
    const contactUrl = `${site}${CONTACT_PATH}`;
    return {
        'billing.plan-migration-announced': ({ row }) => announced(row, actionUrl, contactUrl),
        'billing.plan-migration-upcoming': ({ row }) => upcoming(row),
        'billing.plan-migration-cancelled': ({ row }) => cancelled(row)
    };
}
