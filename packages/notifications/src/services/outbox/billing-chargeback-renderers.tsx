import type { EmailOutboxRow } from '@repo/db';
import { z } from 'zod';
import {
    CHARGEBACK_SUSPENSION_SUBJECT,
    ChargebackSuspension
} from '../../templates/billing/chargeback-suspension.js';
import { formatCurrency, formatDate } from '../../templates/utils/index.js';
import type { OutboxMailRenderer } from './email-outbox-delivery.service.js';

const payloadSchema = z.object({
    subscriptionId: z.string().min(1),
    vertical: z.string().min(1),
    paymentMethod: z.literal('CARD'),
    touristVipLost: z.boolean(),
    oneTimeAddons: z.array(
        z.object({
            name: z.string().min(1),
            remainingDays: z.number().int().positive()
        })
    ),
    chargedBackPayment: z.object({
        amountMinor: z.number().int().nonnegative(),
        currency: z.string().min(1),
        chargedOn: z.iso.date()
    }),
    courtesyEnded: z.boolean()
});

function chargebackSuspension(row: EmailOutboxRow, subscriptionUrl: string) {
    const parsed = payloadSchema.safeParse(row.payload);
    if (!parsed.success)
        throw new TypeError('Faltan datos requeridos del aviso de suspensión por contracargo');
    const data = parsed.data;
    return {
        subject: CHARGEBACK_SUSPENSION_SUBJECT,
        react: (
            <ChargebackSuspension
                vertical={data.vertical}
                amount={formatCurrency({
                    amount: data.chargedBackPayment.amountMinor,
                    currency: data.chargedBackPayment.currency
                })}
                chargedOn={formatDate({ dateString: data.chargedBackPayment.chargedOn })}
                courtesyEnded={data.courtesyEnded}
                touristVipLost={data.touristVipLost}
                oneTimeAddons={data.oneTimeAddons}
                subscriptionUrl={subscriptionUrl}
            />
        )
    };
}

/** Registers the dedicated S6 chargeback outbox renderer (AC:B7:10). */
export function createBillingChargebackRenderers(input: {
    readonly subscriptionUrl: string;
}): Readonly<Record<string, OutboxMailRenderer>> {
    return {
        'billing.chargeback-suspension': ({ row }) =>
            chargebackSuspension(row, input.subscriptionUrl)
    };
}
