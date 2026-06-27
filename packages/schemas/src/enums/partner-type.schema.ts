import { z } from 'zod';
import { PartnerTypeEnum } from './partner-type.enum.js';

export const PartnerTypeEnumSchema = z.nativeEnum(PartnerTypeEnum);

export type PartnerTypeSchema = z.infer<typeof PartnerTypeEnumSchema>;
