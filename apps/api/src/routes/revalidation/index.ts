/**
 * Revalidation Admin Routes
 *
 * Routes for CDN cache-tag revalidation management.
 * Provides admin endpoints for:
 * - Triggering manual revalidation of specific cache tags, or a whole-zone purge
 * - Querying revalidation configuration
 * - Listing revalidation history/logs
 * - Managing revalidation rules
 *
 * All routes are mounted under /api/v1/admin/revalidation.
 *
 * @module routes/revalidation
 */
import { RevalidationConfigModel, RevalidationLogModel } from '@repo/db';
import type { RevalidationEntityType } from '@repo/schemas';
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
import {
    getAffectedCacheTags,
    getRevalidationService,
    RevalidationStatsService,
    WHOLE_ZONE_TARGET
} from '@repo/service-core';
import { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { createRouter } from '../../utils/create-app';
import { apiLogger } from '../../utils/logger';
import { createAdminRoute } from '../../utils/route-factory';

const revalidationRouter = createRouter();

// ============================================================================
// T-066: POST /revalidate/manual
// Trigger manual revalidation of specific cache tags, or an explicit
// whole-zone purge (HOS-369 W1-1)
// ============================================================================

/**
 * POST /api/v1/admin/revalidation/revalidate/manual
 * Manually revalidate a list of specific cache tags, or — only when the
 * request explicitly opts in via `purgeEverything: true` — flush the entire
 * zone. The two shapes are mutually exclusive (see `ManualRevalidateRequestSchema`),
 * so the whole-zone branch below is unreachable from a tags-only body.
 */
export const manualRevalidateRoute = createAdminRoute({
    method: 'post',
    path: '/revalidate/manual',
    summary: 'Manual cache-tag revalidation',
    description:
        'Triggers immediate cache invalidation for a list of specific cache tags, or (via an explicit `purgeEverything: true` flag) a whole-zone purge. Requires REVALIDATION_TRIGGER permission.',
    tags: ['Revalidation'],
    requiredPermissions: [PermissionEnum.REVALIDATION_TRIGGER],
    requestBody: ManualRevalidateRequestSchema,
    responseSchema: RevalidationResponseSchema,
    handler: async (c, _params, body) => {
        const actor = getActorFromContext(c);
        const triggeredBy = actor?.id ?? 'system';
        const service = getRevalidationService();

        // Whole-zone purge branch — reachable ONLY when the caller explicitly
        // set `purgeEverything: true`. A tags-only body never enters here.
        if ('purgeEverything' in body && body.purgeEverything) {
            const { reason } = body as { purgeEverything: true; reason?: string };

            if (!service) {
                apiLogger.warn(
                    { triggeredBy, reason },
                    'Revalidation service not initialized — whole-zone purge skipped'
                );
                return {
                    success: false,
                    revalidated: [],
                    failed: [WHOLE_ZONE_TARGET],
                    duration: 0
                };
            }

            const start = Date.now();
            apiLogger.info({ triggeredBy, reason }, 'Manual whole-zone purge requested');

            try {
                const result = await service.purgeEverything({ reason, triggeredBy });
                return {
                    success: result.success,
                    revalidated: result.success ? [result.target] : [],
                    failed: result.success ? [] : [result.target],
                    duration: Date.now() - start
                };
            } catch (error) {
                apiLogger.error(
                    {
                        error: error instanceof Error ? error.message : String(error),
                        triggeredBy,
                        reason
                    },
                    'Whole-zone purge failed'
                );
                return {
                    success: false,
                    revalidated: [],
                    failed: [WHOLE_ZONE_TARGET],
                    duration: Date.now() - start
                };
            }
        }

        const { tags, reason } = body as { tags: string[]; reason?: string };

        if (!service) {
            apiLogger.warn(
                { triggeredBy, reason },
                'Revalidation service not initialized — manual revalidate skipped'
            );
            return {
                success: false,
                revalidated: [],
                failed: tags,
                duration: 0
            };
        }

        const start = Date.now();

        apiLogger.info({ tags, triggeredBy, reason }, 'Manual revalidation requested');

        try {
            const results = await service.revalidateTags({
                tags,
                triggeredBy,
                reason,
                trigger: 'manual',
                entityType: 'manual'
            });
            const revalidated = results.filter((r) => r.success).map((r) => r.target);
            const failed = results.filter((r) => !r.success).map((r) => r.target);
            return {
                success: failed.length === 0,
                revalidated,
                failed,
                duration: Date.now() - start
            };
        } catch (error) {
            apiLogger.error(
                {
                    error: error instanceof Error ? error.message : String(error),
                    tags,
                    triggeredBy,
                    reason
                },
                'Manual revalidation failed'
            );
            return {
                success: false,
                revalidated: [],
                failed: tags,
                duration: Date.now() - start
            };
        }
    }
});

// ============================================================================
// T-067: POST /revalidate/entity
// Trigger revalidation for all cache tags of a specific entity instance
// ============================================================================

/**
 * POST /api/v1/admin/revalidation/revalidate/entity
 * Revalidate all cache tags associated with a specific entity instance.
 *
 * Uses the configured {@link EntityResolver} to look up the entity by ID,
 * compute its affected cache tags, and trigger immediate revalidation.
 * Falls back to type-level revalidation when no resolver is available.
 */
export const revalidateEntityRoute = createAdminRoute({
    method: 'post',
    path: '/revalidate/entity',
    summary: 'Entity revalidation',
    description:
        'Triggers immediate cache invalidation for all cache tags associated with a specific entity instance (by ID). Falls back to type-level revalidation if the entity cannot be resolved. Requires REVALIDATION_TRIGGER permission.',
    tags: ['Revalidation'],
    requiredPermissions: [PermissionEnum.REVALIDATION_TRIGGER],
    requestBody: RevalidateEntityRequestSchema,
    responseSchema: RevalidationResponseSchema,
    handler: async (c, _params, body) => {
        const { entityType, entityId, reason } = body as {
            entityType: RevalidationEntityType;
            entityId: string;
            reason?: string;
        };

        const actor = getActorFromContext(c);
        const triggeredBy = actor?.id ?? 'system';

        const service = getRevalidationService();
        if (!service) {
            apiLogger.warn(
                { triggeredBy, reason },
                'Revalidation service not initialized — entity revalidate skipped'
            );
            return {
                success: false,
                revalidated: [],
                failed: [entityType],
                duration: 0
            };
        }

        const start = Date.now();

        apiLogger.info(
            { entityType, entityId, triggeredBy, reason },
            'Entity revalidation requested'
        );

        try {
            const resolver = service.getEntityResolver();

            if (resolver) {
                const entityData = await resolver.resolveById({ entityType, entityId });

                if (!entityData) {
                    return c.json(
                        {
                            error: `Entity not found: ${entityType}/${entityId}`,
                            code: 'NOT_FOUND'
                        },
                        404
                    );
                }

                const affectedTags = getAffectedCacheTags(entityData);
                const results = await service.revalidateTags({
                    tags: affectedTags,
                    triggeredBy,
                    reason,
                    trigger: 'manual',
                    entityType
                });

                const revalidated = results.filter((r) => r.success).map((r) => r.target);
                const failed = results.filter((r) => !r.success).map((r) => r.target);

                return {
                    success: failed.length === 0,
                    revalidated,
                    failed,
                    duration: Date.now() - start
                };
            }

            // Fallback: no resolver configured, fall back to type-level revalidation
            apiLogger.info(
                { entityType, entityId },
                'No entity resolver configured — falling back to type-level revalidation'
            );
            await service.revalidateByEntityType({ entityType, trigger: 'manual' });
            return {
                success: true,
                revalidated: [entityType],
                failed: [],
                duration: Date.now() - start
            };
        } catch (error) {
            apiLogger.error(
                {
                    error: error instanceof Error ? error.message : String(error),
                    entityType,
                    entityId,
                    triggeredBy,
                    reason
                },
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
// Trigger revalidation for the collection cache tag of an entire entity type
// ============================================================================

/**
 * POST /api/v1/admin/revalidation/revalidate/type
 * Revalidate the collection cache tag for every instance of a given entity type.
 */
export const revalidateTypeRoute = createAdminRoute({
    method: 'post',
    path: '/revalidate/type',
    summary: 'Entity-type revalidation',
    description:
        'Triggers immediate cache invalidation for the collection cache tag of an entire entity type. Use with caution — may trigger many revalidations. Requires REVALIDATION_TRIGGER permission.',
    tags: ['Revalidation'],
    requiredPermissions: [PermissionEnum.REVALIDATION_TRIGGER],
    requestBody: RevalidateTypeRequestSchema,
    responseSchema: RevalidationResponseSchema,
    handler: async (c, _params, body) => {
        const { entityType, reason } = body as {
            entityType: RevalidationEntityType;
            reason?: string;
        };

        const actor = getActorFromContext(c);
        const triggeredBy = actor?.id ?? 'system';

        const service = getRevalidationService();
        if (!service) {
            apiLogger.warn(
                { triggeredBy, reason },
                'Revalidation service not initialized — type revalidate skipped'
            );
            return {
                success: false,
                revalidated: [],
                failed: [entityType],
                duration: 0
            };
        }

        const start = Date.now();

        apiLogger.info({ entityType, triggeredBy, reason }, 'Type revalidation requested');

        try {
            await service.revalidateByEntityType({ entityType, trigger: 'manual' });
            return {
                success: true,
                revalidated: [entityType],
                failed: [],
                duration: Date.now() - start
            };
        } catch (error) {
            apiLogger.error(
                {
                    error: error instanceof Error ? error.message : String(error),
                    entityType,
                    triggeredBy,
                    reason
                },
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
    responseSchema: z.array(RevalidationConfigSchema),
    handler: async () => {
        const model = new RevalidationConfigModel();
        const { items } = await model.findAll({});
        return items;
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
    responseSchema: RevalidationConfigSchema,
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

        return updated;
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

        const page = Number(query?.page ?? 1);
        const pageSize = Number(query?.pageSize ?? 50);

        const filters: {
            entityType?: string;
            entityId?: string;
            trigger?: string;
            status?: string;
            target?: string;
            fromDate?: Date;
            toDate?: Date;
        } = {};
        if (query?.entityType) filters.entityType = query.entityType as string;
        if (query?.entityId) filters.entityId = query.entityId as string;
        if (query?.trigger) filters.trigger = query.trigger as string;
        if (query?.status) filters.status = query.status as string;
        if (query?.target) filters.target = query.target as string;
        if (query?.fromDate) filters.fromDate = query.fromDate as Date;
        if (query?.toDate) filters.toDate = query.toDate as Date;

        const { items, total } = await model.findWithFilters(filters, { page, pageSize });

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
    responseSchema: RevalidationStatsSchema,
    handler: async () => {
        const statsService = new RevalidationStatsService();
        const stats = await statsService.getStats();
        return stats;
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

        // Deliberately does NOT fire a real purge (HOS-369 W1-1). It used to,
        // which was free when every purge flushed the whole zone anyway. Under
        // purge-by-tag it is not: Cloudflare's Free-plan ceiling is 5 tag-purge
        // requests per MINUTE, so any monitor polling this endpoint would eat
        // the budget content invalidation needs and starve real purges. The
        // check reports what it can observe without spending one — that the
        // singleton is up and which adapter it holds. Whether the upstream
        // credentials actually work is answered by the outcome of real purges
        // in `revalidation_log`, which is a better signal anyway because it
        // reflects production traffic rather than a synthetic tag.
        const start = Date.now();
        try {
            return {
                status: 'operational' as const,
                adapter:
                    service.getAdapterName() === 'NoOpRevalidationAdapter'
                        ? ('none' as const)
                        : ('active' as const),
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
