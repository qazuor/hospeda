import type { EmailOutboxRow } from '@repo/db';
import { getLocalDateString } from '@repo/utils';
import { GRACE_REMINDER_SUBJECT, GraceReminder } from '../../templates/billing/grace-reminder.js';
import type { OutboxMailRenderer } from './email-outbox-delivery.service.js';

function renderGraceReminder(row: EmailOutboxRow, siteUrl: string) {
    const payload: unknown = row.payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
        throw new TypeError('Faltan datos requeridos del aviso de período de gracia');
    const data = payload as Record<string, unknown>;
    if (
        typeof data.subscriptionId !== 'string' ||
        typeof data.vertical !== 'string' ||
        typeof data.graceEndsAt !== 'string' ||
        !Number.isInteger(data.daysBefore) ||
        typeof data.daysBefore !== 'number' ||
        data.daysBefore <= 0 ||
        !Number.isInteger(data.deadlinesVersion) ||
        typeof data.deadlinesVersion !== 'number' ||
        data.deadlinesVersion <= 0
    )
        throw new TypeError('Faltan datos requeridos del aviso de período de gracia');
    const endDate = new Date(data.graceEndsAt);
    if (!Number.isFinite(endDate.getTime()))
        throw new TypeError('Faltan datos requeridos del aviso de período de gracia');
    return {
        subject: GRACE_REMINDER_SUBJECT,
        react: (
            <GraceReminder
                vertical={data.vertical}
                graceEndDate={getLocalDateString({ instant: endDate })}
                daysBefore={data.daysBefore}
                subscriptionUrl={`${siteUrl}/es/mi-cuenta/suscripcion/`}
            />
        )
    };
}

/** Creates the strict renderer for grace reminder outbox rows. */
export function createBillingGraceReminderRenderers(input: {
    readonly siteUrl: string;
}): Readonly<Record<string, OutboxMailRenderer>> {
    return { 'billing.grace-reminder': ({ row }) => renderGraceReminder(row, input.siteUrl) };
}
