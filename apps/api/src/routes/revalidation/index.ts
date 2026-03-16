/**
 * Revalidation Admin Routes
 *
 * Routes for ISR (Incremental Static Regeneration) revalidation management.
 * Provides admin endpoints for:
 * - Triggering manual revalidation of specific paths or tags
 * - Querying revalidation configuration
 * - Listing revalidation history/logs
 * - Managing revalidation rules
 *
 * All routes are mounted under /api/v1/admin/revalidation.
 *
 * @module routes/revalidation
 */
import { RevalidationConfigModel, RevalidationLogModel } from '@repo/db';
import {
    ManualRevalidateRequestSchema,
    PermissionEnum,
    RevalidateEntityRequestSchema,
    RevalidateTypeRequestSchema,
    RevalidationConfigSchema,
    RevalidationLogFilterSchema,
    RevalidationLogSchema,
    RevalidationResponseSchema,
    RevalidationStatsSchema,
    UpdateRevalidationConfigInputSchema
} from '@repo/schemas';
import type { RevalidationEntityType } from '@repo/schemas';
import { getRevalidationService } from '@repo/service-core';
import { z } from 'zod';
import { RevalidationStatsService } from '../../services/revalidation-stats.service';
import { getActorFromContext } from '../../utils/actor';
import { createRouter } from '../../utils/create-app';
import { apiLogger } from '../../utils/logger';
import { createAdminRoute } from '../../utils/route-factory';

const revalidationRouter = createRouter();

// ============================================================================
// T-066: POST /revalidate/manual
// Trigger manual revalidation of specific URL paths
// ============================================================================

/**
 * POST /api/v1/admin/revalidation/revalidate/manual
 * Manually revalidate a list of specific URL paths.
 */
export const manualRevalidateRoute = createAdminRoute({
    method: 'post',
    path: '/revalidate/manual',
    summary: 'Manual path revalidation',
    description:
        'Triggers immediate ISR revalidation for a list of specific URL paths. Requires REVALIDATION_TRIGGER permission.',
    tags: ['Revalidation'],
    requiredPermissions: [PermissionEnum.REVALIDATION_TRIGGER],
    requestBody: ManualRevalidateRequestSchema,
    responseSchema: RevalidationResponseSchema,
    handler: async (c, _params, body) => {
        const { paths, reason } = body as { paths: string[]; reason?: string };

        const actor = getActorFromContext(c);
        const triggeredBy = actor?.id ?? 'system';

        const service = getRevalidationService();
        if (!service) {
            apiLogger.warn(
                { triggeredBy, reason },
                'Revalidation service not initialized — manual revalidate skipped'
            );
            return {
                success: false,
                revalidated: [],
                failed: paths,
                duration: 0
            };
        }

        const start = Date.now();

        apiLogger.info({ paths, triggeredBy, reason }, 'Manual revalidation requested');

        try {
            await service.revalidatePaths(paths);
            return {
                success: true,
                revalidated: paths,
                failed: [],
                duration: Date.now() - start
            };
        } catch (error) {
            apiLogger.error(
                {
                    error: error instanceof Error ? error.message : String(error),
                    paths,
                    triggeredBy,
                    reason
                },
                'Manual revalidation failed'
            );
            return {
                success: false,
                revalidated: [],
                failed: paths,
                duration: Date.now() - start
            };
        }
    }
});

// ============================================================================
// T-067: POST /revalidate/entity
// Trigger revalidation for all paths of a specific entity instance
// ============================================================================

/**
 * POST /api/v1/admin/revalidation/revalidate/entity
 * Revalidate all paths associated with a specific entity type.
 */
export const revalidateEntityRoute = createAdminRoute({
    method: 'post',
    path: '/revalidate/entity',
    summary: 'Entity revalidation',
    description:
        'Triggers immediate ISR revalidation for all paths associated with the given entity type. Requires REVALIDATION_TRIGGER permission.',
    tags: ['Revalidation'],
    requiredPermissions: [PermissionEnum.REVALIDATION_TRIGGER],
    requestBody: RevalidateEntityRequestSchema,
    responseSchema: RevalidationResponseSchema,
    handler: async (_c, _params, body) => {
        const { entityType } = body as {
            entityType: RevalidationEntityType;
            entityId: string;
            reason?: string;
        };

        const service = getRevalidationService();
        if (!service) {
            apiLogger.warn({}, 'Revalidation service not initialized — entity revalidate skipped');
            return {
                success: false,
                revalidated: [],
                failed: [entityType],
                duration: 0
            };
        }

        const start = Date.now();

        try {
            await service.revalidateByEntityType(entityType);
            return {
                success: true,
                revalidated: [entityType],
                failed: [],
                duration: Date.now() - start
            };
        } catch (error) {
            apiLogger.error(
                { error: error instanceof Error ? error.message : String(error), entityType },
                'Entity revalidation failed'
            );
            return {
                success: false,
                revalidated: [],
                failed: [entityType],
                duration: Date.now() - start
            };
        }
    }
});

// ============================================================================
// T-068: POST /revalidate/type
// Trigger revalidation for all paths of an entire entity type
// ============================================================================

/**
 * POST /api/v1/admin/revalidation/revalidate/type
 * Revalidate all paths for every instance of a given entity type.
 */
export const revalidateTypeRoute = createAdminRoute({
    method: 'post',
    path: '/revalidate/type',
    summary: 'Entity-type revalidation',
    description:
        'Triggers immediate ISR revalidation for all paths of an entire entity type. Use with caution — may trigger many revalidations. Requires REVALIDATION_TRIGGER permission.',
    tags: ['Revalidation'],
    requiredPermissions: [PermissionEnum.REVALIDATION_TRIGGER],
    requestBody: RevalidateTypeRequestSchema,
    responseSchema: RevalidationResponseSchema,
    handler: async (_c, _params, body) => {
        const { entityType } = body as {
            entityType: RevalidationEntityType;
            reason?: string;
        };

        const service = getRevalidationService();
        if (!service) {
            apiLogger.warn({}, 'Revalidation service not initialized — type revalidate skipped');
            return {
                success: false,
                revalidated: [],
                failed: [entityType],
                duration: 0
            };
        }

        const start = Date.now();

        try {
            await service.revalidateByEntityType(entityType);
            return {
                success: true,
                revalidated: [entityType],
                failed: [],
                duration: Date.now() - start
            };
        } catch (error) {
            apiLogger.error(
                { error: error instanceof Error ? error.message : String(error), entityType },
                'Type revalidation failed'
            );
            return {
                success: false,
                revalidated: [],
                failed: [entityType],
                duration: Date.now() - start
            };
        }
    }
});

// ============================================================================
// T-069: GET /config  —  list all revalidation configs
// ============================================================================

/**
 * GET /api/v1/admin/revalidation/config
 * List all revalidation configuration records.
 */
export const listRevalidationConfigRoute = createAdminRoute({
    method: 'get',
    path: '/config',
    summary: 'List revalidation configs',
    description:
        'Returns all ISR revalidation configuration records (one per entity type). Requires REVALIDATION_CONFIG_VIEW permission.',
    tags: ['Revalidation'],
    requiredPermissions: [PermissionEnum.REVALIDATION_CONFIG_VIEW],
    responseSchema: z.object({ data: z.array(RevalidationConfigSchema) }),
    handler: async () => {
        const model = new RevalidationConfigModel();
        const { items } = await model.findAll({});
        return { data: items };
    }
});

// ============================================================================
// T-069: PATCH /config/:id  —  update a single revalidation config
// ============================================================================

/**
 * PATCH /api/v1/admin/revalidation/config/:id
 * Update a specific revalidation configuration record.
 */
export const updateRevalidationConfigRoute = createAdminRoute({
    method: 'patch',
    path: '/config/{id}',
    summary: 'Update revalidation config',
    description:
        'Partially updates a revalidation configuration record (intervals, debounce, enabled flag). Requires REVALIDATION_CONFIG_EDIT permission.',
    tags: ['Revalidation'],
    requiredPermissions: [PermissionEnum.REVALIDATION_CONFIG_EDIT],
    requestParams: { id: z.string().uuid('Config ID must be a valid UUID') },
    requestBody: UpdateRevalidationConfigInputSchema,
    responseSchema: z.object({ data: RevalidationConfigSchema }),
    handler: async (c, params, body) => {
        const id = params.id as string;
        const model = new RevalidationConfigModel();

        const existing = await model.findById(id);
        if (!existing) {
            return c.json({ error: 'Revalidation config not found', code: 'NOT_FOUND' }, 404);
        }

        const updated = await model.update({ id }, body as Record<string, unknown>);

        if (!updated) {
            throw new Error(`Revalidation config with id '${id}' not found`);
        }

        return { data: updated };
    }
});

// ============================================================================
// T-070: GET /logs  —  paginated revalidation log listing
// ============================================================================

/**
 * GET /api/v1/admin/revalidation/logs
 * List revalidation log entries with optional filtering.
 */
export const listRevalidationLogsRoute = createAdminRoute({
    method: 'get',
    path: '/logs',
    summary: 'List revalidation logs',
    description:
        'Returns paginated revalidation audit log entries with optional filters by entity type, trigger, status, and date range. Requires REVALIDATION_LOG_VIEW permission.',
    tags: ['Revalidation'],
    requiredPermissions: [PermissionEnum.REVALIDATION_LOG_VIEW],
    requestQuery: RevalidationLogFilterSchema.shape,
    responseSchema: z.object({
        data: z.array(RevalidationLogSchema),
        total: z.number().int()
    }),
    handler: async (_c, _params, _body, query) => {
        const model = new RevalidationLogModel();

        const page = query?.page ?? 1;
        const pageSize = query?.pageSize ?? 50;

        const filters: Record<string, unknown> = {};
        if (query?.entityType) filters.entityType = query.entityType;
        if (query?.entityId) filters.entityId = query.entityId;
        if (query?.trigger) filters.trigger = query.trigger;
        if (query?.status) filters.status = query.status;

        const { items, total } = await model.findAll(filters, { page, pageSize });

        return { data: items, total };
    }
});

// ============================================================================
// T-071: GET /stats  —  aggregated revalidation statistics
// ============================================================================

/**
 * GET /api/v1/admin/revalidation/stats
 * Returns aggregated revalidation statistics for the last 30 days.
 */
export const getRevalidationStatsRoute = createAdminRoute({
    method: 'get',
    path: '/stats',
    summary: 'Revalidation statistics',
    description:
        'Returns aggregated ISR revalidation statistics for the last 30 days, including success rates, average duration, and breakdowns by entity type and trigger. Requires REVALIDATION_CONFIG_VIEW permission.',
    tags: ['Revalidation'],
    requiredPermissions: [PermissionEnum.REVALIDATION_CONFIG_VIEW],
    responseSchema: z.object({ data: RevalidationStatsSchema }),
    handler: async () => {
        const statsService = new RevalidationStatsService();
        const stats = await statsService.getStats();
        return { data: stats };
    }
});

// ============================================================================
// T-072: GET /health  —  revalidation service health check
// ============================================================================

/**
 * GET /api/v1/admin/revalidation/health
 * Returns the operational status of the revalidation service.
 * Public to admin consumers — no special permission required beyond admin access.
 */
export const revalidationHealthRoute = createAdminRoute({
    method: 'get',
    path: '/health',
    summary: 'Revalidation service health',
    description:
        'Returns the operational status of the RevalidationService singleton and its underlying adapter.',
    tags: ['Revalidation'],
    responseSchema: z.object({
        status: z.enum(['operational', 'not_initialized', 'degraded']),
        adapter: z.enum(['active', 'none']),
        latencyMs: z.number().int().optional(),
        error: z.string().optional()
    }),
    options: { skipAuth: false },
    handler: async () => {
        const service = getRevalidationService();
        if (!service) {
            return {
                status: 'not_initialized' as const,
                adapter: 'none' as const
            };
        }

        const start = Date.now();
        try {
            await service.revalidatePaths(['/__health-probe__']);
            return {
                status: 'operational' as const,
                adapter: 'active' as const,
                latencyMs: Date.now() - start
            };
        } catch (error) {
            return {
                status: 'degraded' as const,
                adapter: 'active' as const,
                latencyMs: Date.now() - start,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
});

// ============================================================================
// Mount all routes
// ============================================================================

revalidationRouter.route('/', manualRevalidateRoute);
revalidationRouter.route('/', revalidateEntityRoute);
revalidationRouter.route('/', revalidateTypeRoute);
revalidationRouter.route('/', listRevalidationConfigRoute);
revalidationRouter.route('/', updateRevalidationConfigRoute);
revalidationRouter.route('/', listRevalidationLogsRoute);
revalidationRouter.route('/', getRevalidationStatsRoute);
revalidationRouter.route('/', revalidationHealthRoute);

export { revalidationRouter };
