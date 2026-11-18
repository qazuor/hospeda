import { z } from 'zod';
import { PartnerTypeEnum } from './partner-type.enum.js';

/**
 * Legacy closed partner type set.
 *
 * @deprecated HOS-2336: partner types are the admin-managed `partner_types`
 * catalog. Kept only for the release-N dual-write of `partners.type`; deleted
 * in the N+1 contract release.
 */
export const PartnerTypeEnumSchema = z.nativeEnum(PartnerTypeEnum);
