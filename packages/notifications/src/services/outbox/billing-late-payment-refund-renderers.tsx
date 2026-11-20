import { z } from 'zod';
import { LatePaymentRefunded } from '../../templates/billing/late-payment-refunded.js';
import type { OutboxMailRenderer } from './email-outbox-delivery.service.js';

/** Facts the API turns into localized copy (HOS-2179 P-3, D3). */
export interface LatePaymentRefundMailCopyInput {
    readonly locale: 'es' | 'en' | 'pt';
    readonly addonSlug: string;
    readonly addonName: string;
    readonly amountMinor: number;
    readonly currency: string;
}

/** Localized copy of the mail. */
export interface LatePaymentRefundMailCopy {
    readonly subject: string;
    readonly preview: string;
    readonly heading: string;
    readonly paragraphs: readonly string[];
}

/** Resolves the copy without coupling notifications to an i18n package. */
export type LatePaymentRefundMailCopyResolver = (
    input: LatePaymentRefundMailCopyInput
) => LatePaymentRefundMailCopy;

const payloadSchema = z.strictObject({
    refundId: z.string().min(1),
    paymentId: z.string().min(1),
    addonInstanceId: z.string().min(1),
    locale: z.enum(['es', 'en', 'pt']),
    addonSlug: z.string().min(1),
    addonName: z.string().min(1),
    amountMinor: z.number().int().positive(),
    currency: z.string().regex(/^[A-Z]{3}$/)
});

/** Renderer of `billing.late-payment-refunded`. */
export function createBillingLatePaymentRefundRenderers(input: {
    readonly resolveCopy: LatePaymentRefundMailCopyResolver;
}): Readonly<Record<string, OutboxMailRenderer>> {
    return {
        'billing.late-payment-refunded': ({ row }) => {
            const parsed = payloadSchema.safeParse(row.payload);
            if (!parsed.success) throw new TypeError('Invalid late payment refunded payload');
            const {
                refundId: _refundId,
                paymentId: _paymentId,
                addonInstanceId: _addonInstanceId,
                ...facts
            } = parsed.data;
            const copy = input.resolveCopy(facts);
            return { subject: copy.subject, react: <LatePaymentRefunded {...copy} /> };
        }
    };
}
