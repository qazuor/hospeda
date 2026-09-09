import { z } from 'zod';
import { PartnerPaymentReviewStateEnum } from './partner-payment-review-state.enum.js';

export const PartnerPaymentReviewStateEnumSchema = z.nativeEnum(PartnerPaymentReviewStateEnum);

export type PartnerPaymentReviewStateSchema = z.infer<typeof PartnerPaymentReviewStateEnumSchema>;
