import type { EmailOutboxRow } from '@repo/db';
import {
    PLAN_MIGRATION_ANNOUNCED_SUBJECT,
    PlanMigrationAnnounced
} from '../../templates/billing/plan-migration-announced.js';
import {
    PLAN_MIGRATION_CANCELLED_SUBJECT,
    PlanMigrationCancelled
} from '../../templates/billing/plan-migration-cancelled.js';
import {
    PLAN_MIGRATION_UPCOMING_SUBJECT,
    PlanMigrationUpcoming
} from '../../templates/billing/plan-migration-upcoming.js';
import { formatCurrency } from '../../templates/utils/index.js';
import type { OutboxMailRenderer } from './email-outbox-delivery.service.js';

function payloadOf(row: EmailOutboxRow): Record<string, unknown> {
    const payload: unknown = row.payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError('Faltan datos requeridos del aviso de migración');
    }
    return payload as Record<string, unknown>;
}

function validName(value: unknown): value is string {
    return typeof value === 'string' && value.trim() !== '';
}

function validDate(value: unknown): value is string {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validAmount(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function migrationAmounts(data: Record<string, unknown>) {
    if (!validName(data.currency)) {
        throw new TypeError('Falta la moneda del aviso de migración');
    }
    const { currency } = data;
    return {
        current: validAmount(data.currentAmountMinor)
            ? formatCurrency({ amount: data.currentAmountMinor, currency })
            : null,
        next: validAmount(data.newAmountMinor)
            ? formatCurrency({ amount: data.newAmountMinor, currency })
            : null
    };
}

function announced(row: EmailOutboxRow) {
    const data = payloadOf(row);
    if (
        !validName(data.planName) ||
        (data.variant !== 'SCHEDULED' &&
            data.variant !== 'WAITING' &&
            data.variant !== 'TO_RESOLVE')
    ) {
        throw new TypeError('Faltan datos requeridos del anuncio de migración');
    }
    const variant = data.variant;
    if (
        variant !== 'TO_RESOLVE' &&
        (!validName(data.targetPlanName) ||
            (data.direction !== 'UP' && data.direction !== 'DOWN') ||
            typeof data.losesPromo !== 'boolean' ||
            !validAmount(data.currentAmountMinor) ||
            !validAmount(data.newAmountMinor) ||
            !validName(data.currency) ||
            (variant === 'SCHEDULED' && !validDate(data.applicationDate)))
    ) {
        throw new TypeError('Faltan datos requeridos del anuncio de migración');
    }
    const amounts = variant === 'TO_RESOLVE' ? null : migrationAmounts(data);
    return {
        subject: PLAN_MIGRATION_ANNOUNCED_SUBJECT,
        react: (
            <PlanMigrationAnnounced
                variant={variant}
                planName={data.planName}
                targetPlanName={validName(data.targetPlanName) ? data.targetPlanName : ''}
                direction={data.direction === 'DOWN' ? 'DOWN' : 'UP'}
                currentAmount={amounts?.current ?? ''}
                newAmount={amounts?.next ?? null}
                applicationDate={variant === 'SCHEDULED' ? (data.applicationDate as string) : null}
                losesPromo={data.losesPromo === true}
            />
        )
    };
}

function upcoming(row: EmailOutboxRow) {
    const data = payloadOf(row);
    if (
        !validName(data.planName) ||
        !validName(data.targetPlanName) ||
        (data.direction !== 'UP' && data.direction !== 'DOWN') ||
        typeof data.losesPromo !== 'boolean' ||
        !validDate(data.applicationDate) ||
        typeof data.daysBefore !== 'number' ||
        !Number.isInteger(data.daysBefore) ||
        data.daysBefore <= 0 ||
        !validAmount(data.currentAmountMinor) ||
        !validAmount(data.newAmountMinor)
    ) {
        throw new TypeError('Faltan datos requeridos del recordatorio de migración');
    }
    const amounts = migrationAmounts(data);
    return {
        subject: PLAN_MIGRATION_UPCOMING_SUBJECT,
        react: (
            <PlanMigrationUpcoming
                daysBefore={data.daysBefore}
                planName={data.planName}
                targetPlanName={data.targetPlanName}
                direction={data.direction}
                currentAmount={amounts.current ?? ''}
                newAmount={amounts.next ?? ''}
                applicationDate={data.applicationDate}
                losesPromo={data.losesPromo}
            />
        )
    };
}

function cancelled(row: EmailOutboxRow) {
    const data = payloadOf(row);
    if (
        !validName(data.planName) ||
        (data.variant !== 'NOTHING_CHANGES' && data.variant !== 'ALREADY_STARTED') ||
        (data.variant === 'ALREADY_STARTED' &&
            (!validDate(data.applicationDate) || !validAmount(data.newAmountMinor)))
    ) {
        throw new TypeError('Faltan datos requeridos de la cancelación de migración');
    }
    const newAmount = data.variant === 'ALREADY_STARTED' ? migrationAmounts(data).next : null;
    return {
        subject: PLAN_MIGRATION_CANCELLED_SUBJECT,
        react: (
            <PlanMigrationCancelled
                variant={data.variant}
                planName={data.planName}
                newAmount={newAmount}
                applicationDate={
                    data.variant === 'ALREADY_STARTED' ? (data.applicationDate as string) : null
                }
            />
        )
    };
}

/** Builds renderers for plan migration notices in the shared email outbox. */
export function createBillingPlanMigrationRenderers(_input: {
    readonly siteUrl: string;
}): Readonly<Record<string, OutboxMailRenderer>> {
    return {
        'billing.plan-migration-announced': ({ row }) => announced(row),
        'billing.plan-migration-upcoming': ({ row }) => upcoming(row),
        'billing.plan-migration-cancelled': ({ row }) => cancelled(row)
    };
}
