/**
 * Renderers of the two notices about a scheduled cancellation (S11): the one that precedes
 * cancelling the automatic charge (`billing.scheduled-cancellation`, HOS-1683) and the
 * reminder a few days before the service ends (`billing.access-ending`, HOS-2580 §C).
 *
 * @module services/outbox/billing-cancellation-notice-renderers
 */
import type { EmailOutboxRow } from '@repo/db';
import { getLocalDateString } from '@repo/utils';
import { AccessEnding, accessEndingSubject } from '../../templates/billing/access-ending.js';
import {
    SCHEDULED_CANCELLATION_SUBJECT,
    ScheduledCancellation
} from '../../templates/billing/scheduled-cancellation.js';
import { formatDate } from '../../templates/utils/index.js';
import { isListingNoticeVertical } from './account-listing-paths.js';
import type { OutboxMailRenderer } from './email-outbox-delivery.service.js';

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** Template key of the access-ending reminder; service-core repeats the literal. */
export const ACCESS_ENDING_TEMPLATE = 'billing.access-ending';

function objectPayload(row: EmailOutboxRow, message: string): Record<string, unknown> {
    const payload: unknown = row.payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(message);
    }
    return payload as Record<string, unknown>;
}

/** Formats a stored ISO instant as its market-local day, or null when it is not one. */
function localDayOf(value: unknown): string | null {
    if (typeof value !== 'string' || !ISO_INSTANT.test(value)) return null;
    const instant = new Date(value);
    if (Number.isNaN(instant.getTime())) return null;
    return formatDate({ dateString: getLocalDateString({ instant }) });
}

function scheduledCancellation(row: EmailOutboxRow, subscriptionUrl: string) {
    const missing = 'Faltan datos requeridos del aviso de cancelación del cobro automático';
    const data = objectPayload(row, missing);
    if (
        typeof data.subscriptionId !== 'string' ||
        (data.planName !== undefined && typeof data.planName !== 'string') ||
        (data.vertical !== undefined && typeof data.vertical !== 'string')
    )
        throw new TypeError(missing);
    // Absent or null means a row queued without a readable end: the template falls back.
    let serviceEndDate: string | null = null;
    if (data.serviceEndsAt !== undefined && data.serviceEndsAt !== null) {
        serviceEndDate = localDayOf(data.serviceEndsAt);
        if (!serviceEndDate)
            throw new TypeError(
                'La fecha de fin del servicio del aviso de cancelación no es válida'
            );
    }
    return {
        subject: SCHEDULED_CANCELLATION_SUBJECT,
        react: (
            <ScheduledCancellation
                serviceEndDate={serviceEndDate}
                planName={typeof data.planName === 'string' ? data.planName : null}
                hasListings={isListingNoticeVertical(data.vertical)}
                subscriptionUrl={subscriptionUrl}
            />
        )
    };
}

function accessEnding(row: EmailOutboxRow, subscriptionUrl: string) {
    const missing = 'Faltan datos requeridos del aviso de fin de acceso';
    const data = objectPayload(row, missing);
    const serviceEndDate = localDayOf(data.serviceEndsAt);
    if (
        typeof data.subscriptionId !== 'string' ||
        typeof data.planName !== 'string' ||
        data.planName.trim() === '' ||
        typeof data.vertical !== 'string' ||
        typeof data.daysRemaining !== 'number' ||
        !Number.isInteger(data.daysRemaining) ||
        data.daysRemaining <= 0 ||
        !serviceEndDate
    )
        throw new TypeError(missing);
    return {
        subject: accessEndingSubject({ daysRemaining: data.daysRemaining }),
        react: (
            <AccessEnding
                planName={data.planName}
                serviceEndDate={serviceEndDate}
                daysRemaining={data.daysRemaining}
                hasListings={isListingNoticeVertical(data.vertical)}
                subscriptionUrl={subscriptionUrl}
            />
        )
    };
}

/**
 * Builds the renderers of the scheduled-cancellation notices.
 *
 * @param input.subscriptionUrl - Absolute URL of Mi Suscripción
 * @returns The renderers keyed by outbox template
 */
export function createBillingCancellationNoticeRenderers(input: {
    readonly subscriptionUrl: string;
}): Readonly<Record<string, OutboxMailRenderer>> {
    return {
        'billing.scheduled-cancellation': ({ row }) =>
            scheduledCancellation(row, input.subscriptionUrl),
        [ACCESS_ENDING_TEMPLATE]: ({ row }) => accessEnding(row, input.subscriptionUrl)
    };
}
