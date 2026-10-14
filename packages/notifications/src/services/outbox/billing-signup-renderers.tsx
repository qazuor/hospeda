import type { EmailOutboxRow } from '@repo/db';
import {
    ADDON_CANCELLED_SUBJECT,
    AddonCancelled,
    ARREARS_SUSPENSION_SUBJECT,
    ArrearsSuspension,
    type ArrearsSuspensionOneTimeAddon,
    CLOSED_SUBSCRIPTION_AUTHORIZATION_CANCEL_SUBJECT,
    ClosedSubscriptionAuthorizationCancel,
    FIRST_CHARGE_DECLINED_CANCEL_SUBJECT,
    FirstChargeDeclinedCancel,
    REVOCATION_CANCEL_SUBJECT,
    RevocationCancel,
    SCHEDULED_CANCELLATION_SUBJECT,
    ScheduledCancellation,
    SignupBeforeCancel,
    SignupConfirmed,
    SignupIncomplete,
    TOURIST_VIP_INHERITED_CANCEL_SUBJECT,
    TouristVipInheritedCancel
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

function touristVipInheritedCancel(row: EmailOutboxRow) {
    const data = objectPayload(row);
    if (typeof data.subscriptionId !== 'string')
        throw new TypeError('Faltan datos requeridos del aviso de cancelación de Turista VIP');
    return { subject: TOURIST_VIP_INHERITED_CANCEL_SUBJECT, react: <TouristVipInheritedCancel /> };
}

function addonCancelled(row: EmailOutboxRow) {
    const data = objectPayload(row);
    if (typeof data.subscriptionId !== 'string')
        throw new TypeError('Faltan datos requeridos del aviso de cancelación del addon');
    return { subject: ADDON_CANCELLED_SUBJECT, react: <AddonCancelled /> };
}

function firstChargeDeclinedCancel(row: EmailOutboxRow) {
    const data = objectPayload(row);
    if (typeof data.subscriptionId !== 'string')
        throw new TypeError(
            'Faltan datos requeridos del aviso de cancelación por primer cobro rechazado'
        );
    return { subject: FIRST_CHARGE_DECLINED_CANCEL_SUBJECT, react: <FirstChargeDeclinedCancel /> };
}

function revocationCancel(row: EmailOutboxRow) {
    const data = objectPayload(row);
    if (typeof data.subscriptionId !== 'string')
        throw new TypeError('Faltan datos requeridos del aviso de cancelación por revocación');
    return { subject: REVOCATION_CANCEL_SUBJECT, react: <RevocationCancel /> };
}

function closedSubscriptionAuthorizationCancel(row: EmailOutboxRow) {
    const data = objectPayload(row);
    if (typeof data.subscriptionId !== 'string')
        throw new TypeError(
            'Faltan datos requeridos del aviso de cancelación de una autorización que seguía activa'
        );
    return {
        subject: CLOSED_SUBSCRIPTION_AUTHORIZATION_CANCEL_SUBJECT,
        react: <ClosedSubscriptionAuthorizationCancel />
    };
}

function scheduledCancellation(row: EmailOutboxRow) {
    const data = objectPayload(row);
    if (typeof data.subscriptionId !== 'string')
        throw new TypeError(
            'Faltan datos requeridos del aviso de cancelación del cobro automático'
        );
    return { subject: SCHEDULED_CANCELLATION_SUBJECT, react: <ScheduledCancellation /> };
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

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function oneTimeAddonsOf(value: unknown): readonly ArrearsSuspensionOneTimeAddon[] | null {
    if (!Array.isArray(value)) return null;
    const addons: ArrearsSuspensionOneTimeAddon[] = [];
    for (const item of value) {
        if (!isRecord(item)) return null;
        const { name, remainingDays } = item;
        if (
            typeof name !== 'string' ||
            typeof remainingDays !== 'number' ||
            !Number.isInteger(remainingDays) ||
            remainingDays < 1
        )
            return null;
        addons.push({ name, remainingDays });
    }
    return addons;
}

function arrearsSuspension(row: EmailOutboxRow) {
    const data = objectPayload(row);
    const oneTimeAddons = oneTimeAddonsOf(data.oneTimeAddons);
    if (
        typeof data.subscriptionId !== 'string' ||
        typeof data.vertical !== 'string' ||
        (data.paymentMethod !== 'CARD' && data.paymentMethod !== 'MANUAL') ||
        typeof data.touristVipLost !== 'boolean' ||
        typeof data.promoLost !== 'boolean' ||
        oneTimeAddons === null
    )
        throw new TypeError('Faltan datos requeridos del aviso de suspensión');
    return {
        subject: ARREARS_SUSPENSION_SUBJECT,
        react: (
            <ArrearsSuspension
                vertical={data.vertical}
                paymentMethod={data.paymentMethod}
                touristVipLost={data.touristVipLost}
                oneTimeAddons={oneTimeAddons}
                promoLost={data.promoLost}
            />
        )
    };
}

/**
 * Renderers for the notices emitted by the subscription signup flow, plus the
 * arrears suspension notice of S6 (AC:B7:30) and the notice that precedes the
 * cancellation of an inherited Tourist VIP by S2's and S7's clause (AC:B7:31), the
 * notice that precedes cancelling an orphaned addon's preapproval (A5, AC:B5:27), and the
 * before-cancel notices of HOS-1683, one per kind with no default: a declined first charge
 * (S16/S1), a revocation (S36), a live authorization on a closed row (REJECTION_REVIVED) and
 * a scheduled cancellation (S11/S12). `billing.before-cancel` is S3's alone.
 */
export function createBillingSignupRenderers(_input: {
    readonly siteUrl: string;
}): Readonly<Record<string, OutboxMailRenderer>> {
    return {
        'billing.signup-confirmed': ({ row }) => confirmed(row),
        'billing.before-cancel': ({ row }) => beforeCancel(row),
        'billing.signup-incomplete': ({ row }) => incomplete(row),
        'billing.arrears-suspension': ({ row }) => arrearsSuspension(row),
        'billing.tourist-vip-inherited-cancel': ({ row }) => touristVipInheritedCancel(row),
        'billing.addon-cancelled': ({ row }) => addonCancelled(row),
        'billing.first-charge-declined-cancel': ({ row }) => firstChargeDeclinedCancel(row),
        'billing.revocation-cancel': ({ row }) => revocationCancel(row),
        'billing.closed-subscription-authorization-cancel': ({ row }) =>
            closedSubscriptionAuthorizationCancel(row),
        'billing.scheduled-cancellation': ({ row }) => scheduledCancellation(row)
    };
}
