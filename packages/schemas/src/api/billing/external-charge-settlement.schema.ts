import { z } from 'zod';

/** Body of admin action 14 for settling an approved, unrecorded provider charge. */
export const ExternalChargeSettlementRequestSchema = z.object({
    chargeId: z.string().trim().min(1).max(255),
    note: z.string().trim().max(2000).optional()
});

/** Parsed request for an external charge settlement. */
export type ExternalChargeSettlementRequest = z.infer<typeof ExternalChargeSettlementRequestSchema>;

/** Reception branch taken by the receiver; mirrored from service-core and checked by the route test. */
export const ExternalChargeReceptionSchema = z.enum([
    'P1',
    'S5',
    'S7',
    'S19_RETAINED',
    'CONDITION_FAILED',
    'EXTENDED',
    'NOT_EXTENDED',
    'CROSSING_MARKED'
]);

/** The receiver branch used to settle the charge. */
export type ExternalChargeReception = z.infer<typeof ExternalChargeReceptionSchema>;

/** Public response of admin action 14 charge settlement. */
export const ExternalChargeSettlementResponseSchema = z.object({
    paymentId: z.string().uuid(),
    paymentStatus: z.literal('SUCCEEDED'),
    coverage: z.enum(['WRITTEN', 'DUPLICATE_MARKED', 'NOT_APPLICABLE']),
    reception: ExternalChargeReceptionSchema
});

/** Parsed successful response of an external charge settlement. */
export type ExternalChargeSettlementResponse = z.infer<
    typeof ExternalChargeSettlementResponseSchema
>;
