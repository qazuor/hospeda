import { FeatureFlagPublicResponseSchema } from '@repo/schemas';
import { FeatureFlagService } from '@repo/service-core';
import { createPublicRoute } from '../../../utils/route-factory-tiered';

const featureFlagService = new FeatureFlagService();

export const publicGetFeatureFlagsMeRoute = createPublicRoute({
    method: 'get',
    path: '/me',
    summary: 'Get evaluated feature flags for anonymous user',
    description:
        'Returns evaluated feature flags for an anonymous user (default global values only). Never exposes internals (user lists, roles).',
    tags: ['Feature Flags'],
    responseSchema: FeatureFlagPublicResponseSchema,
    handler: async (_c) => {
        const flags = await featureFlagService.getAllFlags();
        const result: Record<string, boolean> = {};

        for (const [key] of Object.entries(flags)) {
            const enabled = await featureFlagService.evaluateFlag(key, {});
            result[key] = enabled;
        }

        return result;
    },
    options: {
        cacheTTL: 60
    }
});
