import { getModerationEngineHealth } from '@repo/content-moderation/engine/index';
import { PermissionEnum } from '@repo/schemas';
import { z } from 'zod';
import { createAdminRoute } from '../../../utils/route-factory.js';

const ModerationHealthSchema = z.object({
    provider: z.enum(['openai', 'local', 'stub']),
    cacheSize: z.number().int().nonnegative(),
    hitRatioLastHour: z.number().min(0).max(1),
    degradedCountLast24Hours: z.number().int().nonnegative(),
    lastProviderErrorAt: z.string().datetime().nullable(),
    lastDegradedAt: z.string().datetime().nullable()
});

export const adminContentModerationHealthRoute = createAdminRoute({
    method: 'get',
    path: '/health',
    summary: 'Get content moderation engine health',
    description:
        'Returns moderation provider selection, cache health, and degraded-mode telemetry.',
    tags: ['Content Moderation'],
    requiredPermissions: [PermissionEnum.MODERATION_TERM_VIEW],
    responseSchema: ModerationHealthSchema,
    handler: async () => getModerationEngineHealth(),
    options: {
        cacheTTL: 30,
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});
