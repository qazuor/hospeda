import type { EmailOutboxRow } from '@repo/db';
import {
    RENEWAL_UPCOMING_SUBJECT,
    RenewalUpcoming
} from '../../templates/billing/renewal-upcoming.js';
import type { OutboxMailRenderer } from './email-outbox-delivery.service.js';

function objectPayload(row: EmailOutboxRow): Record<string, unknown> {
    const payload: unknown = row.payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError('Faltan datos requeridos del aviso de renovación');
    }
    return payload as Record<string, unknown>;
}

function renewalUpcoming(row: EmailOutboxRow) {
    const data = objectPayload(row);
    if (
        typeof data.subscriptionId !== 'string' ||
        typeof data.planName !== 'string' ||
        data.planName.trim() === '' ||
        typeof data.renewalDate !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(data.renewalDate) ||
        typeof data.daysBefore !== 'number' ||
        !Number.isInteger(data.daysBefore) ||
        data.daysBefore <= 0
    )
        throw new TypeError('Faltan datos requeridos del aviso de renovación');

    return {
        subject: RENEWAL_UPCOMING_SUBJECT,
        react: (
            <RenewalUpcoming
                planName={data.planName}
                renewalDate={data.renewalDate}
                daysBefore={data.daysBefore}
            />
        )
    };
}

/** Builds the PLAZO:13 renewal notice renderer for the production sender. */
export function createBillingRenewalRenderers(_input: {
    readonly siteUrl: string;
}): Readonly<Record<string, OutboxMailRenderer>> {
    return { 'billing.renewal-upcoming': ({ row }) => renewalUpcoming(row) };
}
