import type { Clock } from '@repo/billing-verticals-contract';
import type { PaymentProvider } from '@repo/payments';
import { z } from 'zod';

/** Purchase request validated at the service boundary (AC:B6:12, DEC-CONC-001 📌2, MP:EX-41). */
export const SendOneTimeOrderInputSchema = z.strictObject({
    orderRequestId: z.string().min(1),
    payerEmail: z.email(),
    payment: z.strictObject({
        token: z.string().min(1),
        brand: z.string().min(1),
        kind: z.enum(['credit', 'debit'])
    }),
    correlationId: z.string().optional()
});

/** Input for one persisted purchase request (AC:B6:12, DEC-CONC-001 📌2, MP:EX-41). */
export type SendOneTimeOrderInput = z.infer<typeof SendOneTimeOrderInputSchema>;

/** External dependencies for one order send (AC:B6:12, DEC-CONC-001 📌2, MP:EX-41). */
export type SendOneTimeOrderPorts = {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
};

/** Closed order-send outcomes; A2 and A7 act later (AC:B6:12, DEC-CONC-001 📌2, MP:EX-41). */
export type SendOneTimeOrderOutcome =
    | 'ORDER_PLACED'
    | 'ORDER_DECLINED'
    | 'ORDER_ALREADY_PLACED'
    | 'PREVIOUS_PAYMENT_PROCESSING'
    | 'AWAITING_PROVIDER_ANSWER'
    | 'ORDER_REJECTED'
    | 'NOT_APPLICABLE';

/** Result of one order send (AC:B6:12, DEC-CONC-001 📌2, MP:EX-41). */
export type SendOneTimeOrderResult = {
    readonly instanceId: string | null;
    readonly outcome: SendOneTimeOrderOutcome;
    readonly orderId: string | null;
};
