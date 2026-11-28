/**
 * Turns a receipt and its details into the exact strings the PDF prints
 * (HOS-2682).
 *
 * Pure and synchronous: the layout module only places what this returns, so
 * every rule about WHAT the document says (which fields appear, how a missing
 * one is left out, how a promo is named) is tested here without opening a
 * PDF.
 *
 * Missing data is left out, never printed as a placeholder: a manual payment
 * has no amount and no provider, an add-on has no vertical, a payment without a
 * promo has no promo line. No subtotal or discount amount is printed: nothing
 * stores the price in force on the day of the payment, so a promo is named and
 * the amount is the one paid.
 *
 * @module services/payment-receipt/receipt-content
 */

import { BRAND_CONTACT_EMAIL, BRAND_PHONE_DISPLAY } from '@repo/config';
import {
    RECEIPT_COPY,
    RECEIPT_CURRENCY_LABELS,
    RECEIPT_CYCLE_LABELS,
    RECEIPT_METHOD_LABELS,
    RECEIPT_VERTICAL_LABELS
} from './receipt-copy.js';
import type { ReceiptDetails } from './receipt-details-read.js';
import type { OwnReceipt } from './receipt-read.js';

/** One label/value pair. */
export interface ReceiptField {
    readonly label: string;
    readonly value: string;
}

/** Everything the document prints, already worded. */
export interface ReceiptContent {
    /** `N.º 000042`. */
    readonly numberLabel: string;
    /** Lines of the "Pagado por" column (payer name, then email), only those known. */
    readonly paidBy: readonly string[];
    /** The Hospeda account the payment belongs to (name, email), minus what repeats the payer. */
    readonly account: readonly string[];
    /** Number and dates, right column. */
    readonly meta: readonly ReceiptField[];
    /** The one row of the concepts table. */
    readonly line: {
        readonly title: string;
        readonly subtitle: string | null;
        readonly period: string | null;
        readonly amount: string | null;
    };
    /** The highlighted total band. */
    readonly total: ReceiptField;
    /** "Datos del pago" section. */
    readonly payment: readonly ReceiptField[];
    /** Hospeda's contact data for the footer. */
    readonly contact: readonly string[];
}

/** Formats minor units the way the email does: `$1.500,00`. */
export function formatReceiptAmount(input: {
    readonly amountMinor: number;
    readonly currency: string;
}): string {
    const formatted = (input.amountMinor / 100).toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    const symbol = input.currency === 'ARS' ? '$' : `${input.currency} `;
    return `${symbol}${formatted}`;
}

/** `26/11/2026`, in Argentina's zone so the date matches the one in the email. */
export function formatReceiptDate(input: { readonly date: Date }): string {
    return input.date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'America/Argentina/Buenos_Aires'
    });
}

/** `01/11/2026 al 30/11/2026`: the end is exclusive, so the last covered day is printed. */
export function formatReceiptPeriod(input: {
    readonly start: Date | null;
    readonly end: Date | null;
}): string | null {
    if (!input.start) return null;
    const from = formatReceiptDate({ date: input.start });
    if (!input.end || input.end.getTime() <= input.start.getTime()) return from;
    const lastDay = new Date(input.end.getTime() - 1);
    return `${from} ${RECEIPT_COPY.periodRange} ${formatReceiptDate({ date: lastDay })}`;
}

/** The public site, read off the brand contact address so no domain is typed twice. */
function brandSite(): string {
    const domain = BRAND_CONTACT_EMAIL.split('@')[1] ?? '';
    return domain ? `www.${domain}` : '';
}

function clean(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

/**
 * Words a receipt for print.
 *
 * @param input.receipt - The receipt row, as the owner read it.
 * @param input.details - What else could be read about the payment.
 * @returns The strings of every block of the document.
 */
export function buildReceiptContent(input: {
    readonly receipt: OwnReceipt;
    readonly details: ReceiptDetails;
}): ReceiptContent {
    const { receipt, details } = input;
    const isAddon = receipt.concept.kind === 'ADDON';

    const payerName = clean(receipt.payerName);
    const payerEmail = clean(receipt.payerEmail);
    const accountName = clean(details.accountName);
    const accountEmail = clean(details.accountEmail);
    const paidBy = [payerName, payerEmail].filter((part): part is string => part !== null);
    const account = [accountName, accountEmail].filter(
        (part): part is string => part !== null && !paidBy.includes(part)
    );
    const number = String(receipt.receiptNumber).padStart(6, '0');

    const meta: ReceiptField[] = [
        { label: RECEIPT_COPY.receiptNumber, value: number },
        { label: RECEIPT_COPY.issuedAt, value: formatReceiptDate({ date: receipt.issuedAt }) }
    ];
    if (details.paidAt) {
        meta.push({
            label: RECEIPT_COPY.paidAt,
            value: formatReceiptDate({ date: details.paidAt })
        });
    }

    const vertical = details.vertical ? RECEIPT_VERTICAL_LABELS[details.vertical] : undefined;
    // The receipt row's concept name is today's plan too: only a fallback when the
    // plan is not known to have changed since the payment.
    const productName =
        clean(details.productName) ?? (details.planTrusted ? clean(receipt.concept.name) : null);
    const kindLabel = isAddon ? RECEIPT_COPY.addon : RECEIPT_COPY.subscription;
    const title = [kindLabel, vertical].filter(Boolean).join(' · ');
    const cycle = details.cycle ? RECEIPT_CYCLE_LABELS[details.cycle] : undefined;
    const subtitleParts = [
        productName ? (isAddon ? productName : `${RECEIPT_COPY.plan} ${productName}`) : null,
        cycle ? `${RECEIPT_COPY.cycle} ${cycle.toLowerCase()}` : null
    ].filter((part): part is string => part !== null);

    const paid =
        receipt.amountMinor !== null && receipt.currency !== null
            ? { minor: receipt.amountMinor, currency: receipt.currency }
            : null;
    const money = (minor: number): string =>
        formatReceiptAmount({ amountMinor: minor, currency: paid?.currency ?? 'ARS' });

    const payment: ReceiptField[] = [];
    if (details.method) {
        payment.push({ label: RECEIPT_COPY.method, value: RECEIPT_METHOD_LABELS[details.method] });
    }
    if (details.operationId) {
        payment.push({
            label:
                details.method === 'MANUAL'
                    ? RECEIPT_COPY.manualReference
                    : RECEIPT_COPY.operationId,
            value: details.operationId
        });
    }
    if (details.promoCodes.length > 0) {
        payment.push({ label: RECEIPT_COPY.promo, value: details.promoCodes.join(', ') });
    }
    if (paid) {
        payment.push({
            label: RECEIPT_COPY.currency,
            value: RECEIPT_CURRENCY_LABELS[paid.currency] ?? paid.currency
        });
    }

    return {
        numberLabel: `${RECEIPT_COPY.numberPrefix} ${number}`,
        paidBy,
        account,
        meta,
        line: {
            title,
            subtitle: subtitleParts.length > 0 ? subtitleParts.join(' · ') : null,
            period: formatReceiptPeriod({ start: details.periodStart, end: details.periodEnd }),
            amount: paid ? money(paid.minor) : null
        },
        total: {
            label: paid ? RECEIPT_COPY.total : RECEIPT_COPY.manualAmount,
            value: paid ? money(paid.minor) : ''
        },
        payment,
        contact: [BRAND_CONTACT_EMAIL, BRAND_PHONE_DISPLAY, brandSite()].filter(
            (part) => part !== ''
        )
    };
}
