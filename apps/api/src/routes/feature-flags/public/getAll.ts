import { FeatureFlagPublicResponseSchema } from '@repo/schemas';
import { FeatureFlagService } from '@repo/service-core';
import { createPublicRoute } from '../../../utils/route-factory-tiered';

const featureFlagService = new FeatureFlagService();

export const publicGetAllFlagsRoute = createPublicRoute({
    method: 'get',
    path: '/',
    summary: 'Get all active feature flags',
    description:
        'Returns a key-value map of all active (enabled + not kill-switched) feature flags.',
    tags: ['Feature Flags'],
    responseSchema: FeatureFlagPublicResponseSchema,
    handler: async () => featureFlagService.getAllFlags(),
    options: {
        cacheTTL: 60
    }
});
