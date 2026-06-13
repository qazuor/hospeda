/**
 * Admin AI translation routes (SPEC-212 T-009, T-010).
 *
 * Mounted at `/api/v1/admin/ai/translate/*` by the main router.
 * Provides batch translation and manual override endpoints for SUPER_ADMINs.
 *
 * Routes:
 * - POST /batch    — batch translate entities of a given type (paginated)
 * - PUT  /override — manually override a translation for a specific field+locale
 *
 * @module routes/ai/admin/translate
 */

import { PermissionEnum } from '@repo/schemas';
import { z } from 'zod';
import { adminAuthMiddleware } from '../../../middlewares/authorization';
import {
    type TranslatableEntityType,
    applyManualOverride,
    batchTranslate
} from '../../../services/ai-translate.service';
import { getActorFromContext } from '../../../utils/actor';
import { createRouter } from '../../../utils/create-app';
import { apiLogger } from '../../../utils/logger';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const BatchTranslateRequestSchema = z.object({
    entityType: z.enum(['accommodation', 'destination', 'event', 'post']),
    cursor: z.string().optional(),
    batchSize: z.coerce.number().int().min(1).max(50).default(10)
});

const OverrideRequestSchema = z.object({
    entityType: z.enum(['accommodation', 'destination', 'event', 'post']),
    entityId: z.string().uuid(),
    locale: z.enum(['en', 'pt']),
    fieldType: z.string().min(1).max(100),
    value: z.string()
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const adminAiTranslateRoute = createRouter();

// Auth middleware for all routes
adminAiTranslateRoute.use('*', adminAuthMiddleware([PermissionEnum.AI_SETTINGS_MANAGE]));

// ---------------------------------------------------------------------------
// POST /batch
// ---------------------------------------------------------------------------

adminAiTranslateRoute.post('/batch', async (c) => {
    const rawBody = await c.req.json();
    const parsed = BatchTranslateRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
        return c.json(
            {
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Invalid request body' }
            },
            400
        );
    }

    const { entityType, cursor, batchSize } = parsed.data;
    const actor = getActorFromContext(c);

    apiLogger.info(
        { userId: actor.id, entityType, batchSize },
        'admin-ai-translate: batch started'
    );

    try {
        const result = await batchTranslate({
            entityType: entityType as TranslatableEntityType,
            cursor,
            batchSize
        });

        return c.json({
            success: true,
            data: {
                translated: result.translated,
                skipped: result.skipped,
                failed: result.failed,
                nextCursor: result.nextCursor,
                errors: result.errors
            }
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        apiLogger.error(
            { userId: actor.id, entityType, error: errorMessage },
            'admin-ai-translate: batch failed'
        );
        return c.json(
            {
                success: false,
                error: { code: 'BATCH_FAILED', message: 'Batch translation failed' }
            },
            500
        );
    }
});

// ---------------------------------------------------------------------------
// PUT /override
// ---------------------------------------------------------------------------

adminAiTranslateRoute.put('/override', async (c) => {
    const rawBody = await c.req.json();
    const parsed = OverrideRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
        return c.json(
            {
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Invalid request body' }
            },
            400
        );
    }

    const { entityType, entityId, locale, fieldType, value } = parsed.data;
    const actor = getActorFromContext(c);

    apiLogger.info(
        { userId: actor.id, entityType, entityId, fieldType, locale },
        'admin-ai-translate: manual override'
    );

    try {
        const result = await applyManualOverride({
            entityType: entityType as TranslatableEntityType,
            entityId,
            fieldType,
            locale,
            value
        });

        if (!result.ok) {
            if (result.code === 'INVALID_FIELD') {
                return c.json(
                    {
                        success: false,
                        error: {
                            code: 'INVALID_FIELD',
                            message: `Field '${fieldType}' is not translatable for entity type '${entityType}'`
                        }
                    },
                    400
                );
            }
            return c.json(
                {
                    success: false,
                    error: { code: 'NOT_FOUND', message: `${entityType} not found` }
                },
                404
            );
        }

        apiLogger.info(
            { userId: actor.id, entityType, entityId, fieldType, locale },
            'admin-ai-translate: manual override persisted'
        );

        return c.json({
            success: true,
            data: { entityType, entityId, fieldType, locale }
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        apiLogger.error(
            { userId: actor.id, entityType, entityId, error: errorMessage },
            'admin-ai-translate: manual override failed'
        );
        return c.json(
            {
                success: false,
                error: { code: 'OVERRIDE_FAILED', message: 'Manual override failed' }
            },
            500
        );
    }
});
