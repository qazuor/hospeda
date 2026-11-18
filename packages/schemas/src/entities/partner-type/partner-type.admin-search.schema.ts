import type { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { LifecycleStatusEnumSchema } from '../../enums/index.js';

/**
 * Admin list search for partner types (HOS-2336). `search` matches slug and
 * Spanish name; `lifecycleState` filters active/inactive rows.
 */
export const PartnerTypeAdminSearchSchema = AdminSearchBaseSchema.extend({
    lifecycleState: LifecycleStatusEnumSchema.optional()
});

/** Inferred type of {@link PartnerTypeAdminSearchSchema}. */
export type PartnerTypeAdminSearch = z.infer<typeof PartnerTypeAdminSearchSchema>;
