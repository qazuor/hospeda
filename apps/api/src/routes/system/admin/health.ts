/**
 * Admin system-health endpoint — SPEC-155 follow-up (card E).
 *
 * Returns the live status of the platform's core dependencies (database +
 * Redis) for the admin dashboard "Estado del sistema" widget.
 *
 * WHY a dedicated admin endpoint instead of the root `/health`:
 * The root `GET /health` is registered in `create-app.ts` BEFORE the CORS
 * middleware, so it never emits CORS headers. The admin panel calls the API
 * cross-origin with `credentials: 'include'`, which the browser blocks without
 * a matching `Access-Control-Allow-Origin`. This endpoint lives under
 * `/api/v1/admin/*`, so it inherits the CORS + auth + actor middleware stack
 * and is readable from the admin SPA.
 *
 * Permission: SYSTEM_MAINTENANCE_MODE — same gate as the cron-admin endpoints
 * (dashboard card D), keeping all "platform operations" widgets behind one
 * consistent permission.
 *
 * @module routes/system/admin/health
 */
import { getDb, sql } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { z } from 'zod';
import { apiLogger } from '../../../utils/logger.js';
import { getRedisClient } from '../../../utils/redis.js';
import { createAdminRoute } from '../../../utils/route-factory.js';

/**
 * Inner data payload for the system-health endpoint.
 *
 * Defined inline because it is endpoint-private and only consumed by the admin
 * dashboard resolver + the OpenAPI generator.
 *   - `status`: overall rollup — `up` (all good), `degraded` (db ok, redis
 *     unreachable), `down` (db unreachable).
 *   - `db` / `redis`: per-dependency connection state. Redis may be `unknown`
 *     when `HOSPEDA_REDIS_URL` is unset (the API runs with in-memory fallbacks).
 */
const SystemHealthDataSchema = z.object({
    status: z.enum(['up', 'degraded', 'down']),
    db: z.enum(['connected', 'disconnected']),
    redis: z.enum(['connected', 'disconnected', 'unknown']),
    uptime: z.number(),
    timestamp: z.string()
});

/**
 * GET /api/v1/admin/system/health
 *
 * Checks the database (`SELECT 1`) and Redis (`PING`) in parallel and returns a
 * rolled-up status. The DB is the only hard dependency: a failed Redis ping
 * degrades but does not bring the system `down`. Cached 30 s.
 */
export const adminSystemHealthRoute = createAdminRoute({
    method: 'get',
    path: '/health',
    summary: 'Get system health (admin)',
    description:
        'Returns the live status of core platform dependencies (database, Redis) for the ' +
        'admin dashboard. Requires SYSTEM_MAINTENANCE_MODE permission.',
    tags: ['System'],
    requiredPermissions: [PermissionEnum.SYSTEM_MAINTENANCE_MODE],
    responseSchema: SystemHealthDataSchema,
    handler: async () => {
        const [db, redis] = await Promise.all([checkDb(), checkRedis()]);

        const status =
            db === 'disconnected' ? 'down' : redis === 'disconnected' ? 'degraded' : 'up';

        return {
            status,
            db,
            redis,
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        } as const;
    },
    options: {
        cacheTTL: 30,
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});

/** Probes the database with a trivial `SELECT 1`. */
async function checkDb(): Promise<'connected' | 'disconnected'> {
    try {
        await getDb().execute(sql`SELECT 1`);
        return 'connected';
    } catch (error) {
        apiLogger.warn({ message: 'system-health: DB check failed', error: String(error) });
        return 'disconnected';
    }
}

/**
 * Probes Redis with `PING`. Returns `unknown` when Redis is not configured
 * (the API falls back to in-memory stores in that mode — not an error).
 */
async function checkRedis(): Promise<'connected' | 'disconnected' | 'unknown'> {
    try {
        const client = await getRedisClient();
        if (!client) return 'unknown';
        await client.ping();
        return 'connected';
    } catch (error) {
        apiLogger.warn({ message: 'system-health: Redis check failed', error: String(error) });
        return 'disconnected';
    }
}
