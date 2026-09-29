import type { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { createBooleanQueryParam } from '../../common/boolean-params.js';

export const FeatureFlagAdminSearchSchema = AdminSearchBaseSchema.extend({
    isActive: createBooleanQueryParam('Filter by active status'),
    enabled: createBooleanQueryParam('Filter by enabled status')
});

export type FeatureFlagAdminSearch = z.infer<typeof FeatureFlagAdminSearchSchema>;
