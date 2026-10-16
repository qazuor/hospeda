import type { EmailOutboxRow } from '@repo/db';
import { PROMO_ENDING_SUBJECT, PromoEnding } from '../../templates/billing/promo-ending.js';
import { formatCurrency } from '../../templates/utils/index.js';
import type { OutboxMailRenderer } from './email-outbox-delivery.service.js';

function promoEnding(row: EmailOutboxRow) {
    const payload: unknown = row.payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError('Faltan datos requeridos del aviso de fin de promo');
    }
    const data = payload as Record<string, unknown>;
    if (
        typeof data.planName !== 'string' ||
        data.planName.trim() === '' ||
        typeof data.lastDiscountedChargeDate !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(data.lastDiscountedChargeDate) ||
        typeof data.amountAfterMinor !== 'number' ||
        !Number.isInteger(data.amountAfterMinor) ||
        data.amountAfterMinor < 0 ||
        typeof data.currency !== 'string' ||
        data.currency.trim() === ''
    )
        throw new TypeError('Faltan datos requeridos del aviso de fin de promo');
    return {
        subject: PROMO_ENDING_SUBJECT,
        react: (
            <PromoEnding
                planName={data.planName}
                lastDiscountedChargeDate={data.lastDiscountedChargeDate}
                amountAfter={formatCurrency({
                    amount: data.amountAfterMinor,
                    currency: data.currency
                })}
            />
        )
    };
}

/** Builds the billing promo-ending renderer for the production sender. */
export function createBillingPromoRenderers(_input: {
    readonly siteUrl: string;
}): Readonly<Record<string, OutboxMailRenderer>> {
    return { 'billing.promo-ending': ({ row }) => promoEnding(row) };
}
