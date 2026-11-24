import { z } from 'zod';
import {
    MANUAL_INSTALLMENT_UNPAID_SUBJECT,
    ManualInstallmentUnpaid
} from '../../templates/billing/manual-installment-unpaid.js';
import type { OutboxMailRenderer } from './email-outbox-delivery.service.js';
import { readSubjectContext, type SubjectEnrichment } from './reconciliation-context.js';

const payloadSchema = z.strictObject({
    manualPaymentId: z.string().min(1),
    subscriptionId: z.string().min(1),
    vertical: z.string().min(1),
    periodStart: z.iso.datetime(),
    openedAt: z.iso.datetime(),
    firstInstallment: z.boolean()
});

/**
 * Renderers for manual payment billing notices.
 *
 * The unpaid-installment notice links to the subscription page in the admin
 * panel when `adminUrl` is given, and names the holder when `readSubjects` can
 * resolve it. Both are optional and a failing reader never blocks the send
 * (HOS-2565 D9).
 *
 * @param input - Optional admin URL and holder reader.
 * @returns The renderers keyed by outbox template.
 */
export function createBillingManualPaymentRenderers(
    input: Pick<SubjectEnrichment, 'readSubjects' | 'adminUrl' | 'onEnrichmentError'> = {}
): Readonly<Record<string, OutboxMailRenderer>> {
    const adminUrl = input.adminUrl?.replace(/\/$/, '');
    const enrichment: SubjectEnrichment = { ...input, ...(adminUrl ? { adminUrl } : {}) };
    async function render(data: z.infer<typeof payloadSchema>) {
        const context = await readSubjectContext({
            enrichment,
            lookup: { subscriptionIds: [data.subscriptionId], addonInstanceIds: [] }
        });
        return {
            subject: MANUAL_INSTALLMENT_UNPAID_SUBJECT,
            react: (
                <ManualInstallmentUnpaid
                    {...data}
                    context={context}
                    {...(adminUrl ? { adminUrl } : {})}
                />
            )
        };
    }
    return {
        'billing.manual-installment-unpaid': ({ row }) => {
            const parsed = payloadSchema.safeParse(row.payload);
            // Validation stays synchronous (a bad payload throws at once); only the lookup is awaited.
            if (!parsed.success) throw new TypeError('Invalid manual installment notice payload');
            return render(parsed.data);
        }
    };
}
