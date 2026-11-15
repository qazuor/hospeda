import { z } from 'zod';
import {
    MANUAL_INSTALLMENT_UNPAID_SUBJECT,
    ManualInstallmentUnpaid
} from '../../templates/billing/manual-installment-unpaid.js';
import type { OutboxMailRenderer } from './email-outbox-delivery.service.js';

const payloadSchema = z.strictObject({
    manualPaymentId: z.string().min(1),
    subscriptionId: z.string().min(1),
    vertical: z.string().min(1),
    periodStart: z.iso.datetime(),
    openedAt: z.iso.datetime(),
    firstInstallment: z.boolean()
});

/** Renderers for manual payment billing notices. */
export function createBillingManualPaymentRenderers(): Readonly<
    Record<string, OutboxMailRenderer>
> {
    return {
        'billing.manual-installment-unpaid': ({ row }) => {
            const parsed = payloadSchema.safeParse(row.payload);
            if (!parsed.success) throw new TypeError('Invalid manual installment notice payload');
            return {
                subject: MANUAL_INSTALLMENT_UNPAID_SUBJECT,
                react: <ManualInstallmentUnpaid {...parsed.data} />
            };
        }
    };
}
