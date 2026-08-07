import { z } from 'zod';
import { PartnerContentReviewStateEnum } from './partner-content-review-state.enum.js';

export const PartnerContentReviewStateEnumSchema = z.nativeEnum(PartnerContentReviewStateEnum);

export type PartnerContentReviewStateSchema = z.infer<typeof PartnerContentReviewStateEnumSchema>;
