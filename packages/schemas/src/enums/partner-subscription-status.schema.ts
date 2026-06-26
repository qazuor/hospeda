import { z } from 'zod';
import { PartnerSubscriptionStatusEnum } from './partner-subscription-status.enum.js';

export const PartnerSubscriptionStatusEnumSchema = z.nativeEnum(PartnerSubscriptionStatusEnum);

export type PartnerSubscriptionStatusSchema = z.infer<typeof PartnerSubscriptionStatusEnumSchema>;
