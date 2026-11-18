import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { TranslationMetaSchema } from '../../common/i18n.schema.js';
import { PartnerTypeIdSchema } from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import {
    PartnerTypeDisplayWeightSchema,
    PartnerTypeNameSchema,
    PartnerTypeSlugSchema
} from './partner-type.fields.js';

/**
 * Partner Type Schema (HOS-2336).
 *
 * One kind of partner organization (e.g. «Comercio», «Medio», «Persona»).
 * Replaces the closed `PartnerTypeEnum`: a partner points at exactly one of
 * these through `partners.type_id`. Admin-managed: rows carry their own
 * `nameI18n` instead of i18n keys, following the HOS-919 catalog precedent. A
 * deactivated type (`lifecycleState` `INACTIVE`) is no longer offered for new
 * assignments but stays on partners that already have it.
 */
export const PartnerTypeSchema = z.object({
    id: PartnerTypeIdSchema,
    ...BaseAuditFields,
    ...BaseLifecycleFields,
    ...BaseAdminFields,
    slug: PartnerTypeSlugSchema,
    nameI18n: PartnerTypeNameSchema,
    /** Per-locale translation curation metadata. Admin responses only. */
    translationMeta: TranslationMetaSchema.nullish(),
    displayWeight: PartnerTypeDisplayWeightSchema
});

/** A partner type row. */
export type PartnerType = z.infer<typeof PartnerTypeSchema>;
