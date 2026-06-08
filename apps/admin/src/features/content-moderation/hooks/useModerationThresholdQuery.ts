import { createEntityHooks } from '@/lib/factories/createEntityHooks';
import type { ContentModerationThreshold } from '@repo/schemas';

/**
 * Entity hooks for moderation thresholds CRUD operations.
 */
export const {
    useList: useModerationThresholdsList,
    useDetail: useModerationThresholdDetail,
    useUpdate: useUpdateModerationThreshold
} = createEntityHooks<ContentModerationThreshold>({
    entityName: 'moderation-thresholds',
    apiEndpoint: '/api/v1/admin/content-moderation/thresholds'
});
