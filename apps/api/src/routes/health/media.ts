/**
 * Public media health check route.
 *
 * Verifies that the configured Cloudinary credentials still authenticate
 * against the upstream backend. Backed by `provider.healthCheck()`, which
 * calls the cheap `cloudinary.api.ping()` admin endpoint — no asset is
 * uploaded, listed, or mutated.
 *
 * Behavior:
 *   - 200 with `{status: 'ok', cloudName?}` when auth succeeds.
 *   - 503 with `{status: 'error', message}` when:
 *       * the provider is not configured (production with missing creds), or
 *       * the upstream ping fails (bad creds, network error, 5xx).
 *
 * SPEC-078-GAPS GAP-078-232.
 *
 * @module routes/health/media
 */
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { getMediaProvider } from '../../services/media.js';
import { createRouter } from '../../utils/create-app.js';
import { env } from '../../utils/env.js';
import { apiLogger } from '../../utils/logger.js';

/**
 * Inner data payload returned for `/health/media`.
 *
 * Defined inline because it is endpoint-private and only consumed by the
 * OpenAPI generator. Keeping it out of `@repo/schemas` avoids leaking a
 * schema that no other surface depends on.
 */
const MediaHealthDataSchema = z.object({
    status: z.enum(['ok', 'error']),
    cloudName: z.string().optional(),
    message: z.string().optional(),
    timestamp: z.string()
});

/**
 * Standard envelope mirrors the `successResponseSchema` shape used by every
 * other route, so the global response validator middleware does not flag it
 * in development.
 */
const MediaHealthResponseSchema = z.object({
    success: z.boolean(),
    data: MediaHealthDataSchema,
    metadata: z.object({
        timestamp: z.string(),
        requestId: z.string()
    })
});

const mediaHealthRoute = createRoute({
    method: 'get',
    path: '/media',
    summary: 'Media provider health check',
    description:
        'Verifies the configured image provider (Cloudinary) can authenticate. Returns 503 when not configured or when the upstream ping fails.',
    tags: ['Health'],
    responses: {
        200: {
            description: 'Provider authenticated successfully',
            content: { 'application/json': { schema: MediaHealthResponseSchema } }
        },
        503: {
            description: 'Provider unavailable or unauthenticated',
            content: { 'application/json': { schema: MediaHealthResponseSchema } }
        }
    }
});

const app = createRouter();

app.openapi(mediaHealthRoute, async (c) => {
    const provider = getMediaProvider();
    const timestamp = new Date().toISOString();
    const metadata = {
        timestamp,
        requestId: c.get('requestId') || 'unknown'
    };

    if (!provider) {
        apiLogger.warn('[health/media] Provider not configured');
        return c.json(
            {
                success: true,
                data: {
                    status: 'error' as const,
                    message: 'Media provider is not configured',
                    timestamp
                },
                metadata
            },
            503
        );
    }

    const result = await provider.healthCheck();

    if (result.ok) {
        return c.json(
            {
                success: true,
                data: {
                    status: 'ok' as const,
                    cloudName: env.HOSPEDA_CLOUDINARY_CLOUD_NAME ?? undefined,
                    timestamp
                },
                metadata
            },
            200
        );
    }

    apiLogger.warn(
        `[health/media] Provider health check failed: ${result.message ?? 'unknown error'}`
    );
    return c.json(
        {
            success: true,
            data: {
                status: 'error' as const,
                message: result.message ?? 'Media provider health check failed',
                timestamp
            },
            metadata
        },
        503
    );
});

export { app as mediaHealthRoutes };
