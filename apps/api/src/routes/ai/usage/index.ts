/**
 * Admin AI usage reporting routes (SPEC-173 T-033).
 *
 * Exposes three read-only aggregate endpoints over the `ai_usage` table.
 * All data is produced by the reporting helpers in `@repo/ai-core` — this
 * module is a thin HTTP adapter (pagination, query validation, permission guard).
 *
 * Routes:
 * - GET /monthly   — time-bucketed rollup, optional date range + filters
 * - GET /by-user   — per-user rollup for a given calendar month (YYYY + M)
 * - GET /by-feature — per-feature rollup for a given calendar month (YYYY + M)
 *
 * All routes require `AI_SETTINGS_MANAGE` permission (SUPER_ADMIN-only).
 *
 * @module routes/ai/usage
 */

import { getMonthlyUsage, getUsageByFeature, getUsageByUser } from '@repo/ai-core';
import {
    AiFeatureSchema,
    AiUsageByFeatureRowSchema,
    AiUsageByUserRowSchema,
    AiUsageMonthlyRowSchema,
    PermissionEnum
} from '@repo/schemas';
import { z } from 'zod';
import { createRouter } from '../../../utils/create-app.js';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination.js';
import { createAdminListRoute } from '../../../utils/route-factory.js';

// ---------------------------------------------------------------------------
// Shared year/month sub-schemas
// ---------------------------------------------------------------------------

/** Calendar year: integer in range [2024, 2100]. */
const YearSchema = z.coerce
    .number()
    .int()
    .min(2024, 'year must be >= 2024')
    .max(2100, 'year must be <= 2100');

/** Calendar month: integer in range [1, 12]. */
const MonthSchema = z.coerce
    .number()
    .int()
    .min(1, 'month must be >= 1')
    .max(12, 'month must be <= 12');

// ---------------------------------------------------------------------------
// Query schemas
// ---------------------------------------------------------------------------

/**
 * Query params for GET /monthly.
 *
 * `since` / `until` are ISO date strings coerced to `Date`.
 * When both are present, `since` must be <= `until`.
 */
const MonthlyQuerySchema = z
    .object({
        since: z.coerce.date().optional(),
        until: z.coerce.date().optional(),
        userId: z.string().uuid('userId must be a valid UUID').optional(),
        feature: AiFeatureSchema.optional()
    })
    .refine(
        (v) => {
            if (v.since !== undefined && v.until !== undefined) {
                return v.since <= v.until;
            }
            return true;
        },
        { message: 'since must be <= until', path: ['since'] }
    );

/**
 * Query params for GET /by-user.
 *
 * `year` and `month` are REQUIRED; `feature` is optional.
 */
const ByUserQuerySchema = z.object({
    year: YearSchema,
    month: MonthSchema,
    feature: AiFeatureSchema.optional()
});

/**
 * Query params for GET /by-feature.
 *
 * `year` and `month` are REQUIRED; `userId` is optional.
 */
const ByFeatureQuerySchema = z.object({
    year: YearSchema,
    month: MonthSchema,
    userId: z.string().uuid('userId must be a valid UUID').optional()
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/admin/ai/usage/monthly
 *
 * Returns AI usage aggregated by calendar month (UTC). Supports optional
 * `since` / `until` date range filters and per-user / per-feature narrowing.
 * Results are paginated with the standard page + pageSize mechanism.
 *
 * - `since` / `until`: ISO date strings (e.g. `2026-01-01`). If both are
 *   present, `since` must be <= `until` (400 otherwise).
 * - `userId`: UUID — narrows to a single user.
 * - `feature`: one of the `AiFeature` enum values.
 *
 * Requires AI_SETTINGS_MANAGE permission.
 */
const listMonthlyUsageRoute = createAdminListRoute({
    method: 'get',
    path: '/monthly',
    summary: 'List AI monthly usage',
    description:
        'Returns AI usage totals aggregated by calendar month (UTC). ' +
        'Optionally filter by date range (`since`/`until`), user (`userId`), or feature. ' +
        'Results are ordered by month ASC. ' +
        'Requires AI_SETTINGS_MANAGE permission.',
    tags: ['AI Usage'],
    requiredPermissions: [PermissionEnum.AI_SETTINGS_MANAGE],
    requestQuery: MonthlyQuerySchema.shape,
    responseSchema: AiUsageMonthlyRowSchema,
    handler: async (_c, _params, _body, query) => {
        const { page, pageSize } = extractPaginationParams(query ?? {});
        const parsed = MonthlyQuerySchema.parse(query ?? {});

        const rows = await getMonthlyUsage({
            since: parsed.since,
            until: parsed.until,
            userId: parsed.userId,
            feature: parsed.feature
        });

        const total = rows.length;
        const start = (page - 1) * pageSize;
        const items = Array.from(rows).slice(start, start + pageSize);

        return {
            items,
            pagination: getPaginationResponse(total, { page, pageSize })
        };
    }
});

/**
 * GET /api/v1/admin/ai/usage/by-user
 *
 * Returns AI usage aggregated per user for a given calendar month.
 * `year` and `month` are required query parameters.
 * Results are ordered by calls DESC. Rows with `userId: null` represent
 * anonymised usage from deleted users.
 *
 * Requires AI_SETTINGS_MANAGE permission.
 */
const listUsageByUserRoute = createAdminListRoute({
    method: 'get',
    path: '/by-user',
    summary: 'List AI usage by user',
    description:
        'Returns AI usage totals aggregated per user for the specified calendar month (UTC). ' +
        '`year` and `month` are required. Optionally narrow by `feature`. ' +
        'Rows with `userId: null` represent anonymised (deleted-user) data. ' +
        'Results are ordered by calls DESC. ' +
        'Requires AI_SETTINGS_MANAGE permission.',
    tags: ['AI Usage'],
    requiredPermissions: [PermissionEnum.AI_SETTINGS_MANAGE],
    requestQuery: ByUserQuerySchema.shape,
    responseSchema: AiUsageByUserRowSchema,
    handler: async (_c, _params, _body, query) => {
        const { page, pageSize } = extractPaginationParams(query ?? {});
        const parsed = ByUserQuerySchema.parse(query ?? {});

        const rows = await getUsageByUser({
            year: parsed.year,
            month: parsed.month,
            feature: parsed.feature
        });

        const total = rows.length;
        const start = (page - 1) * pageSize;
        const items = Array.from(rows).slice(start, start + pageSize);

        return {
            items,
            pagination: getPaginationResponse(total, { page, pageSize })
        };
    }
});

/**
 * GET /api/v1/admin/ai/usage/by-feature
 *
 * Returns AI usage aggregated per AI feature for a given calendar month.
 * `year` and `month` are required query parameters.
 * Results are ordered by calls DESC.
 *
 * Requires AI_SETTINGS_MANAGE permission.
 */
const listUsageByFeatureRoute = createAdminListRoute({
    method: 'get',
    path: '/by-feature',
    summary: 'List AI usage by feature',
    description:
        'Returns AI usage totals aggregated per AI feature for the specified calendar month (UTC). ' +
        '`year` and `month` are required. Optionally narrow by `userId`. ' +
        'Results are ordered by calls DESC. ' +
        'Requires AI_SETTINGS_MANAGE permission.',
    tags: ['AI Usage'],
    requiredPermissions: [PermissionEnum.AI_SETTINGS_MANAGE],
    requestQuery: ByFeatureQuerySchema.shape,
    responseSchema: AiUsageByFeatureRowSchema,
    handler: async (_c, _params, _body, query) => {
        const { page, pageSize } = extractPaginationParams(query ?? {});
        const parsed = ByFeatureQuerySchema.parse(query ?? {});

        const rows = await getUsageByFeature({
            year: parsed.year,
            month: parsed.month,
            userId: parsed.userId
        });

        const total = rows.length;
        const start = (page - 1) * pageSize;
        const items = Array.from(rows).slice(start, start + pageSize);

        return {
            items,
            pagination: getPaginationResponse(total, { page, pageSize })
        };
    }
});

// ---------------------------------------------------------------------------
// Router assembly
// ---------------------------------------------------------------------------

const app = createRouter();

app.route('/', listMonthlyUsageRoute);
app.route('/', listUsageByUserRoute);
app.route('/', listUsageByFeatureRoute);

export { app as adminAiUsageRoutes };
