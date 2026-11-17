import type { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { HostTradeCategoryGroupIdSchema } from '../../common/id.schema.js';
import { LifecycleStatusEnumSchema } from '../../enums/index.js';

/**
 * Admin list search for category groups (HOS-919). `search` matches slug and
 * Spanish name; `lifecycleState` filters active/inactive rows.
 */
export const HostTradeCategoryGroupAdminSearchSchema = AdminSearchBaseSchema.extend({
    lifecycleState: LifecycleStatusEnumSchema.optional()
});

/**
 * Admin list search for categories (HOS-919). Adds a group filter on top of
 * the group search.
 */
export const HostTradeCategoryAdminSearchSchema = HostTradeCategoryGroupAdminSearchSchema.extend({
    groupId: HostTradeCategoryGroupIdSchema.optional()
});

export type HostTradeCategoryGroupAdminSearch = z.infer<
    typeof HostTradeCategoryGroupAdminSearchSchema
>;
export type HostTradeCategoryAdminSearch = z.infer<typeof HostTradeCategoryAdminSearchSchema>;
