import { resolveSignupDeclinedMessage } from '@repo/billing';
import type { EmailOutboxRow } from '@repo/db';
import { getLocalDateString } from '@repo/utils';
import {
    ADDON_CANCELLED_SUBJECT,
    AddonCancelled,
    ARREARS_SUSPENSION_SUBJECT,
    ArrearsSuspension,
    type ArrearsSuspensionOneTimeAddon,
    CLOSED_SUBSCRIPTION_AUTHORIZATION_CANCEL_SUBJECT,
    ClosedSubscriptionAuthorizationCancel,
    DIRECT_CANCELLATION_SUBJECT,
    DirectCancellation,
    FIRST_CHARGE_DECLINED_CANCEL_SUBJECT,
    FirstChargeDeclinedCancel,
    GRACE_STARTED_SUBJECT,
    GraceStarted,
    PAYMENT_CREDITED_SUBJECT,
    PaymentCredited,
    PERMANENT_GRANT_ADDON_CANCEL_SUBJECT,
    PERMANENT_GRANT_CANCEL_SUBJECT,
    PermanentGrantAddonCancel,
    PermanentGrantCancel,
    REVOCATION_CANCEL_SUBJECT,
    RevocationCancel,
    SCHEDULED_CANCELLATION_SUBJECT,
    ScheduledCancellation,
    SIGNUP_DECLINED_SUBJECT,
    SignupBeforeCancel,
    SignupConfirmed,
    SignupDeclined,
    SignupIncomplete,
    TOURIST_VIP_INHERITED_CANCEL_SUBJECT,
    TouristVipInheritedCancel
} from '../../templates/billing/index.js';
import { formatCurrency, formatDate } from '../../templates/utils/index.js';
import type { OutboxMailRenderer } from './email-outbox-delivery.service.js';

const SUBSCRIPTION_PATH = '/es/mi-cuenta/suscripcion/';
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

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

function permanentGrantCancel(row: EmailOutboxRow) {
    const data = objectPayload(row);
    if (typeof data.subscriptionId !== 'string')
        throw new TypeError(
            'Faltan datos requeridos del aviso de cancelación por grant permanente'
        );
    return { subject: PERMANENT_GRANT_CANCEL_SUBJECT, react: <PermanentGrantCancel /> };
}

function permanentGrantAddonCancel(row: EmailOutboxRow) {
    const data = objectPayload(row);
    if (typeof data.subscriptionId !== 'string')
        throw new TypeError('Faltan datos requeridos del aviso de cancelación del addon por grant');
    return { subject: PERMANENT_GRANT_ADDON_CANCEL_SUBJECT, react: <PermanentGrantAddonCancel /> };
}

function directCancellation(row: EmailOutboxRow) {
    const data = objectPayload(row);
    if (typeof data.subscriptionId !== 'string')
        throw new TypeError('Faltan datos requeridos del aviso de baja directa');
    return { subject: DIRECT_CANCELLATION_SUBJECT, react: <DirectCancellation /> };
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
    const serviceEndsAt = data.serviceEndsAt;
    let serviceEndDate: string | null = null;
    if (serviceEndsAt !== undefined && serviceEndsAt !== null) {
        if (typeof serviceEndsAt !== 'string' || !ISO_INSTANT.test(serviceEndsAt))
            throw new TypeError(
                'La fecha de fin del servicio del aviso de cancelación no es válida'
            );
        const instant = new Date(serviceEndsAt);
        if (Number.isNaN(instant.getTime()))
            throw new TypeError(
                'La fecha de fin del servicio del aviso de cancelación no es válida'
            );
        serviceEndDate = formatDate({ dateString: getLocalDateString({ instant }) });
    }
    return {
        subject: SCHEDULED_CANCELLATION_SUBJECT,
        react: <ScheduledCancellation serviceEndDate={serviceEndDate} />
    };
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

function signupDeclined(row: EmailOutboxRow, subscriptionUrl: string) {
    const data = objectPayload(row);
    if (
        typeof data.subscriptionId !== 'string' ||
        data.subscriptionId.trim() === '' ||
        typeof data.vertical !== 'string' ||
        data.vertical.trim() === '' ||
        (data.declineReason !== null && typeof data.declineReason !== 'string') ||
        typeof data.successionPredecessor !== 'boolean'
    )
        throw new TypeError('Faltan datos requeridos del aviso de alta rechazada');
    const { cause, retry } = resolveSignupDeclinedMessage({
        declineReason: data.declineReason as string | null,
        successionPredecessor: data.successionPredecessor
    });
    return {
        subject: SIGNUP_DECLINED_SUBJECT,
        react: (
            <SignupDeclined
                vertical={data.vertical}
                subscriptionUrl={subscriptionUrl}
                cause={cause}
                retry={retry}
            />
        )
    };
}

function graceStarted(row: EmailOutboxRow, subscriptionUrl: string) {
    const data = objectPayload(row);
    const graceEndsAt =
        typeof data.graceEndsAt === 'string' && ISO_INSTANT.test(data.graceEndsAt)
            ? new Date(data.graceEndsAt)
            : null;
    if (
        typeof data.subscriptionId !== 'string' ||
        data.subscriptionId.trim() === '' ||
        typeof data.vertical !== 'string' ||
        data.vertical.trim() === '' ||
        !graceEndsAt ||
        Number.isNaN(graceEndsAt.getTime())
    )
        throw new TypeError('Faltan datos requeridos del aviso de inicio del grace');
    const graceEndDate = formatDate({ dateString: getLocalDateString({ instant: graceEndsAt }) });
    return {
        subject: GRACE_STARTED_SUBJECT,
        react: (
            <GraceStarted
                vertical={data.vertical}
                graceEndDate={graceEndDate}
                subscriptionUrl={subscriptionUrl}
            />
        )
    };
}

function paymentCredited(row: EmailOutboxRow) {
    const data = objectPayload(row);
    const hasSubscription =
        Object.hasOwn(data, 'subscriptionId') &&
        (typeof data.subscriptionId === 'string' || data.subscriptionId === null);
    const hasAddon =
        Object.hasOwn(data, 'addonInstanceId') &&
        typeof data.addonInstanceId === 'string' &&
        data.addonInstanceId.trim() !== '';
    if (
        typeof data.paymentId !== 'string' ||
        data.paymentId.trim() === '' ||
        typeof data.currency !== 'string' ||
        data.currency.trim() === '' ||
        typeof data.receiptId !== 'string' ||
        data.receiptId.trim() === '' ||
        typeof data.amountMinor !== 'number' ||
        !Number.isInteger(data.amountMinor) ||
        data.amountMinor < 0 ||
        typeof data.receiptNumber !== 'number' ||
        !Number.isInteger(data.receiptNumber) ||
        data.receiptNumber <= 0 ||
        Number(hasSubscription) + Number(hasAddon) !== 1 ||
        (hasSubscription &&
            typeof data.subscriptionId === 'string' &&
            data.subscriptionId.trim() === '')
    )
        throw new TypeError('Faltan datos requeridos del aviso de pago acreditado');
    const creditedDate = formatDate({ dateString: getLocalDateString({ instant: row.createdAt }) });
    return {
        subject: PAYMENT_CREDITED_SUBJECT,
        react: (
            <PaymentCredited
                amount={formatCurrency({ amount: data.amountMinor, currency: data.currency })}
                receiptNumber={data.receiptNumber}
                creditedDate={creditedDate}
            />
        )
    };
}

/**
 * Renderers for the notices emitted by the subscription signup flow, plus the
 * arrears suspension notice of S6 (AC:B7:30) and the notice that precedes the
 * cancellation of an inherited Tourist VIP by S2's and S7's clause (AC:B7:31), the
 * notice that precedes cancelling an orphaned addon's preapproval (A5, AC:B5:27), and the
 * before-cancel notices of HOS-1683, plus S16 signup decline, S4 grace start and P1 credited payment (HOS-1675); HOS-1618 adds AC:B13a:5 branches to signup-declined. Each kind has no default: a declined first charge
 * (S16/S1), a revocation (S36), a live authorization on a closed row (REJECTION_REVIVED) and
 * a scheduled cancellation (S11/S12). `billing.before-cancel` is S3's alone.
 */
export function createBillingSignupRenderers(input: {
    readonly siteUrl: string;
}): Readonly<Record<string, OutboxMailRenderer>> {
    const subscriptionUrl = `${input.siteUrl.replace(/\/$/, '')}${SUBSCRIPTION_PATH}`;
    return {
        'billing.signup-declined': ({ row }) => signupDeclined(row, subscriptionUrl),
        'billing.grace-started': ({ row }) => graceStarted(row, subscriptionUrl),
        'billing.payment-credited': ({ row }) => paymentCredited(row),
        'billing.signup-confirmed': ({ row }) => confirmed(row),
        'billing.before-cancel': ({ row }) => beforeCancel(row),
        'billing.signup-incomplete': ({ row }) => incomplete(row),
        'billing.arrears-suspension': ({ row }) => arrearsSuspension(row),
        'billing.tourist-vip-inherited-cancel': ({ row }) => touristVipInheritedCancel(row),
        'billing.addon-cancelled': ({ row }) => addonCancelled(row),
        'billing.first-charge-declined-cancel': ({ row }) => firstChargeDeclinedCancel(row),
        'billing.revocation-cancel': ({ row }) => revocationCancel(row),
        'billing.permanent-grant-cancel': ({ row }) => permanentGrantCancel(row),
        'billing.permanent-grant-addon-cancel': ({ row }) => permanentGrantAddonCancel(row),
        'billing.closed-subscription-authorization-cancel': ({ row }) =>
            closedSubscriptionAuthorizationCancel(row),
        'billing.scheduled-cancellation': ({ row }) => scheduledCancellation(row),
        'billing.direct-cancellation': ({ row }) => directCancellation(row)
    };
}
