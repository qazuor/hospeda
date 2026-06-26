import { z } from 'zod';
import { PartnerTierEnum } from './partner-tier.enum.js';

export const PartnerTierEnumSchema = z.nativeEnum(PartnerTierEnum);

export type PartnerTierSchema = z.infer<typeof PartnerTierEnumSchema>;
