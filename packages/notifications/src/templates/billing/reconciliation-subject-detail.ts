import { formatBillingCycleLabel, formatCurrency } from '../utils/format-helpers.js';
import type {
    ReconciliationAddonDetail,
    ReconciliationSubscriptionDetail,
    ReconciliationSummaryContext
} from './reconciliation-summary-enrichment.js';

/**
 * What the staff mails say about the subject of a mark, resolved from the
 * render-time context (HOS-1971, HOS-2565 D9). Every field is optional by
 * design: a subject the reader could not find simply has no rows.
 *
 * @module templates/billing/reconciliation-subject-detail
 */

/** Plain-words name of each vertical, as the staff read it. */
const VERTICAL_LABELS: Readonly<Record<string, string>> = {
    accommodation: 'Alojamientos',
    venue: 'Comer y salir',
    experience: 'Experiencias',
    tourist: 'Turistas',
    partner: 'Aliados'
};

/** Plain-words name of each subscription or add-on status. */
const STATUS_LABELS: Readonly<Record<string, string>> = {
    PENDING_AUTHORIZATION: 'pendiente de autorización',
    ABANDONED: 'abandonada',
    ACTIVE: 'activa',
    GRACE_PERIOD: 'en gracia',
    PAUSED: 'pausada',
    SUSPENDED: 'suspendida',
    CANCEL_SCHEDULED: 'baja programada',
    CANCELLED: 'cancelada',
    CHARGE_DECLINED: 'cobro rechazado'
};

const MAX_LISTING_NAMES = 3;

/** The rows a subject can contribute. `null` means the data is not available. */
export interface SubjectDescription {
    /** Holder name and email, e.g. `Ana <ana@example.com>`. */
    readonly holder: string | null;
    /** Up to three listing names. */
    readonly listings: string | null;
    /** Vertical, plan, cycle and price, in one phrase. */
    readonly plan: string | null;
    /** Status in plain words. */
    readonly status: string;
}

/** Name and email of a holder, whichever exist. */
function holderText(detail: {
    readonly holderName: string | null;
    readonly holderEmail: string | null;
}): string | null {
    if (detail.holderName && detail.holderEmail)
        return `${detail.holderName} <${detail.holderEmail}>`;
    return detail.holderName ?? detail.holderEmail;
}

/** Up to three listing names, with the count of the rest. */
function listingsText(names: readonly string[]): string | null {
    if (names.length === 0) return null;
    const shown = names.slice(0, MAX_LISTING_NAMES).join(', ');
    const rest = names.length - MAX_LISTING_NAMES;
    return rest > 0 ? `${shown} y ${rest} más` : shown;
}

/** Vertical, plan, cycle and price of a subscription, in one phrase. */
function planText(detail: ReconciliationSubscriptionDetail): string | null {
    const parts = [
        detail.vertical ? (VERTICAL_LABELS[detail.vertical] ?? detail.vertical) : null,
        detail.planName,
        detail.cycle ? formatBillingCycleLabel({ cycle: detail.cycle }).toLowerCase() : null,
        detail.amountMinor !== null && detail.currency
            ? formatCurrency({ amount: detail.amountMinor, currency: detail.currency })
            : null
    ].filter((part): part is string => part !== null);
    return parts.length ? parts.join(' ') : null;
}

/**
 * Describes the subject of a mark from the render-time context.
 *
 * @param input.context - Resolved details, absent when nothing was enriched
 * @param input.subjectType - `subscription` or `addon_instance`
 * @param input.subjectId - The subject's id
 * @returns The description, or `null` when the subject was not resolved
 */
export function describeSubject(input: {
    readonly context: ReconciliationSummaryContext | undefined;
    readonly subjectType: 'subscription' | 'addon_instance';
    readonly subjectId: string;
}): SubjectDescription | null {
    const { context, subjectType, subjectId } = input;
    if (subjectType === 'subscription') {
        const detail = context?.subscriptions.get(subjectId);
        if (!detail) return null;
        return {
            holder: holderText(detail),
            listings: listingsText(detail.listingNames),
            plan: planText(detail),
            status: STATUS_LABELS[detail.status] ?? detail.status
        };
    }
    const addon: ReconciliationAddonDetail | undefined = context?.addonInstances.get(subjectId);
    if (!addon) return null;
    return {
        holder: holderText(addon),
        listings: null,
        plan: addon.addonName ? `Complemento ${addon.addonName}` : 'Complemento',
        status: STATUS_LABELS[addon.status] ?? addon.status
    };
}
