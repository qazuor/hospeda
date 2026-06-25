import { FeatureFlagPublicResponseSchema } from '@repo/schemas';
import { FeatureFlagService } from '@repo/service-core';
import type { Actor } from '../../../middlewares/actor';
import { createProtectedRoute } from '../../../utils/route-factory-tiered';

const featureFlagService = new FeatureFlagService();

export const protectedGetFeatureFlagsMeRoute = createProtectedRoute({
    method: 'get',
    path: '/me',
    summary: 'Get evaluated feature flags for current user',
    description:
        'Returns evaluated feature flags for the authenticated user, applying user-specific and role-specific overrides. Never exposes internals (user lists, roles).',
    tags: ['Feature Flags'],
    responseSchema: FeatureFlagPublicResponseSchema,
    handler: async (c) => {
        const actor: Actor = c.get('actor');
        const flags = await featureFlagService.getAllFlags();
        const result: Record<string, boolean> = {};

        const context = {
            userId: actor.id,
            role: actor.role
        };

        for (const [key] of Object.entries(flags)) {
            const enabled = await featureFlagService.evaluateFlag(key, context);
            result[key] = enabled;
        }

        return result;
    },
    options: {
        cacheTTL: 60
    }
});
