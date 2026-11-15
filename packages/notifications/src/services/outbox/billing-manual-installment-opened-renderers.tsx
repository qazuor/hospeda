import { z } from 'zod';
import { ManualInstallmentOpened } from '../../templates/billing/manual-installment-opened.js';
import type { OutboxMailRenderer } from './email-outbox-delivery.service.js';

/** Facts the API turns into localized copy (HOS-2130). */
export interface ManualInstallmentMailCopyInput {
    readonly locale: 'es' | 'en' | 'pt';
    readonly planSlug: string;
    readonly planName: string;
    readonly amountMinor: number | null;
    readonly currency: 'ARS' | null;
    readonly dueAt: Date;
    readonly firstInstallment: boolean;
}

/** Localized copy of the mail. */
export interface ManualInstallmentMailCopy {
    readonly subject: string;
    readonly preview: string;
    readonly heading: string;
    readonly paragraphs: readonly string[];
    readonly cta: string;
}

/** Resolves the copy without coupling notifications to an i18n package. */
export type ManualInstallmentMailCopyResolver = (
    input: ManualInstallmentMailCopyInput
) => ManualInstallmentMailCopy;

const payloadSchema = z
    .strictObject({
        manualPaymentId: z.string().min(1),
        subscriptionId: z.string().min(1),
        locale: z.enum(['es', 'en', 'pt']),
        planSlug: z.string().min(1),
        planName: z.string().min(1),
        amountMinor: z.number().int().nonnegative().nullable(),
        currency: z.literal('ARS').nullable(),
        dueAt: z.iso.datetime(),
        firstInstallment: z.boolean()
    })
    .refine((payload) => (payload.amountMinor === null) === (payload.currency === null));

/** Renderer of `billing.manual-installment-opened`. */
export function createBillingManualInstallmentOpenedRenderers(input: {
    readonly siteUrl: string;
    readonly resolveCopy: ManualInstallmentMailCopyResolver;
}): Readonly<Record<string, OutboxMailRenderer>> {
    return {
        'billing.manual-installment-opened': ({ row }) => {
            const parsed = payloadSchema.safeParse(row.payload);
            if (!parsed.success) throw new TypeError('Invalid manual installment opened payload');
            const {
                manualPaymentId: _manualPaymentId,
                subscriptionId: _subscriptionId,
                ...facts
            } = parsed.data;
            const copy = input.resolveCopy({ ...facts, dueAt: new Date(facts.dueAt) });
            return {
                subject: copy.subject,
                react: (
                    <ManualInstallmentOpened
                        {...copy}
                        baseUrl={input.siteUrl.replace(/\/$/, '')}
                        locale={parsed.data.locale}
                    />
                )
            };
        }
    };
}
