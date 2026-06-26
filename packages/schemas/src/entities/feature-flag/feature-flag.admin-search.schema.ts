import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';

export const FeatureFlagAdminSearchSchema = AdminSearchBaseSchema.extend({
    isActive: z.coerce.boolean().optional(),
    enabled: z.coerce.boolean().optional()
});

export type FeatureFlagAdminSearch = z.infer<typeof FeatureFlagAdminSearchSchema>;
