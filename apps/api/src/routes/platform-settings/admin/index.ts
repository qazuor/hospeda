/**
 * Admin platform settings routes (SPEC-156, PR-1).
 *
 * Mounted at `/api/v1/admin/platform-settings`.
 *
 * Permission model:
 *   - The middleware only enforces admin-access (defense in depth).
 *   - Per-key permission gating is done inside `PlatformSettingsService` because
 *     the required permission depends on the URL key param:
 *       seo.defaults      → SETTINGS_GENERAL_VIEW / SETTINGS_GENERAL_WRITE
 *       maintenance.mode  → MAINTENANCE_MODE_WRITE
 *       announcements.global → MAINTENANCE_MODE_WRITE
 *     A static `requiredPermissions` array on the route would either be too
 *     permissive (drop the check) or too strict (require the union of all),
 *     so the per-key gate lives in the service layer (T-004) and the
 *     middleware just ensures the actor is an admin.
 */

import { PermissionEnum, PlatformSettingsKeySchema, ServiceErrorCode } from '@repo/schemas';
import type { PlatformSettingsKey } from '@repo/schemas';
import { PlatformSettingsService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor.js';
import { createRouter } from '../../../utils/create-app.js';
import { apiLogger } from '../../../utils/logger.js';
import { createAdminRoute } from '../../../utils/route-factory.js';

const service = new PlatformSettingsService({ logger: apiLogger });

/**
 * GET /api/v1/admin/platform-settings/{key} — read a single platform setting row.
 *
 * Responses:
 *   200 — `{ key, value, updatedAt, updatedBy }` for the requested key.
 *   200 — `null` when the key has never been written (callers fall back to defaults).
 *   400 — unknown key (Zod rejection).
 *   401 — unauthenticated.
 *   403 — authenticated but lacks the per-key permission (service-layer gate).
 */
export const adminGetPlatformSettingsRoute = createAdminRoute({
    method: 'get',
    path: '/{key}',
    summary: 'Get platform setting by key',
    description:
        'Returns the current value for a platform setting (SEO defaults, maintenance mode, or global announcements). Returns null when the key has never been written.',
    tags: ['Platform Settings'],
    // No static requiredPermissions — per-key gate lives in the service.
    // Anyone with admin access can hit this route; the service rejects with
    // FORBIDDEN when the actor lacks the perm for the specific key.
    requiredPermissions: [PermissionEnum.ACCESS_PANEL_ADMIN],
    requestParams: {
        key: PlatformSettingsKeySchema
    },
    responseSchema: z
        .object({
            key: PlatformSettingsKeySchema,
            value: z.unknown(),
            updatedAt: z.string().datetime({ offset: true }),
            updatedBy: z.string().uuid()
        })
        .nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const key = params.key as PlatformSettingsKey;
        const result = await service.get({ actor, key });
        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }
        const row = result.data ?? null;
        if (!row) {
            return null;
        }
        // Serialize Date → ISO string at the API boundary.
        return {
            key: row.key as PlatformSettingsKey,
            value: row.value,
            updatedAt: row.updatedAt.toISOString(),
            updatedBy: row.updatedBy
        };
    }
});

/**
 * Body schema for PATCH. The discriminated-union validation of `value` per
 * `key` lives in `PlatformSettingsService.upsert` (T-004) — it parses against
 * the appropriate per-key Zod schema and returns VALIDATION_ERROR on mismatch.
 * Exposing `value: unknown` here keeps the route thin and avoids duplicating
 * the discriminator at two layers.
 */
const PatchBodySchema = z.object({
    value: z.unknown()
});

/**
 * PATCH /api/v1/admin/platform-settings/{key} — upsert a single platform setting row.
 *
 * Responses:
 *   200 — `{ key, value, updatedAt, updatedBy }` after the upsert.
 *   400 — unknown key (param Zod) or value-shape mismatch for the key (service Zod).
 *   401 — unauthenticated.
 *   403 — authenticated but lacks the per-key write permission (service-layer gate).
 *
 * Side effect: writes to `seo.defaults` trigger a best-effort revalidation of
 * post pages (tech-analysis D7). Revalidation failures do NOT roll back the
 * upsert — the response status is independent of cache invalidation outcomes.
 */
export const adminPatchPlatformSettingsRoute = createAdminRoute({
    method: 'patch',
    path: '/{key}',
    summary: 'Upsert platform setting by key',
    description:
        'Inserts or updates the value for a platform setting (SEO defaults, maintenance mode, or global announcements). Writes to seo.defaults trigger a best-effort revalidation of post pages.',
    tags: ['Platform Settings'],
    requiredPermissions: [PermissionEnum.ACCESS_PANEL_ADMIN],
    requestParams: {
        key: PlatformSettingsKeySchema
    },
    requestBody: PatchBodySchema,
    responseSchema: z.object({
        key: PlatformSettingsKeySchema,
        value: z.unknown(),
        updatedAt: z.string().datetime({ offset: true }),
        updatedBy: z.string().uuid()
    }),
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const key = params.key as PlatformSettingsKey;
        const { value } = body as { value: unknown };

        const result = await service.upsert({ actor, key, value });
        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }
        // upsert always returns a row on success — guard for type safety.
        if (!result.data) {
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Upsert succeeded but no row was returned'
            );
        }
        return {
            key: result.data.key as PlatformSettingsKey,
            value: result.data.value,
            updatedAt: result.data.updatedAt.toISOString(),
            updatedBy: result.data.updatedBy
        };
    }
});

const router = createRouter();
router.route('/', adminGetPlatformSettingsRoute);
router.route('/', adminPatchPlatformSettingsRoute);

export { router as adminPlatformSettingsRoutes };
