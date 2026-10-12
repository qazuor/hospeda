import type { EmailOutboxRow } from '@repo/db';
import {
    SignupBeforeCancel,
    SignupConfirmed,
    SignupIncomplete
} from '../../templates/billing/index.js';
import type { OutboxMailRenderer } from './email-outbox-delivery.service.js';

function objectPayload(row: EmailOutboxRow): Record<string, unknown> {
    const payload: unknown = row.payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError('El payload del aviso de alta no es válido');
    }
    return payload as Record<string, unknown>;
}

function confirmed(row: EmailOutboxRow) {
    const data = objectPayload(row);
    if (
        typeof data.subscriptionId !== 'string' ||
        typeof data.vertical !== 'string' ||
        typeof data.planName !== 'string' ||
        typeof data.firstChargeDate !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(data.firstChargeDate)
    )
        throw new TypeError('Faltan datos requeridos del aviso de alta');
    return {
        subject: 'Tu suscripción está activa',
        react: (
            <SignupConfirmed
                planName={data.planName}
                firstChargeDate={data.firstChargeDate}
            />
        )
    };
}

function beforeCancel(row: EmailOutboxRow) {
    const data = objectPayload(row);
    if (typeof data.subscriptionId !== 'string')
        throw new TypeError('Faltan datos requeridos del aviso de cancelación');
    return { subject: 'Tu autorización pendiente venció', react: <SignupBeforeCancel /> };
}

function incomplete(row: EmailOutboxRow) {
    const data = objectPayload(row);
    if (
        typeof data.subscriptionId !== 'string' ||
        typeof data.vertical !== 'string' ||
        typeof data.paymentMethod !== 'string' ||
        (data.windowEndsAt !== null && typeof data.windowEndsAt !== 'string') ||
        (data.closedCourtesyMonths !== null && typeof data.closedCourtesyMonths !== 'number')
    )
        throw new TypeError('Faltan datos requeridos del aviso de alta incompleta');
    return {
        subject: 'Tu alta quedó sin completarse',
        react: (
            <SignupIncomplete
                vertical={data.vertical}
                closedCourtesyMonths={data.closedCourtesyMonths}
            />
        )
    };
}

/** Renderers for the three notices emitted by the subscription signup flow. */
export function createBillingSignupRenderers(_input: {
    readonly siteUrl: string;
}): Readonly<Record<string, OutboxMailRenderer>> {
    return {
        'billing.signup-confirmed': ({ row }) => confirmed(row),
        'billing.before-cancel': ({ row }) => beforeCancel(row),
        'billing.signup-incomplete': ({ row }) => incomplete(row)
    };
}
