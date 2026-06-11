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

import { z } from 'zod';
import { PermissionEnum } from '@repo/schemas';
import {
    batchTranslate,
    type TranslatableEntityType
} from '../../../services/ai-translate.service';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createRouter } from '../../../utils/create-app';
import { adminAuthMiddleware } from '../../../middlewares/authorization';

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
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request body' } },
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
            { success: false, error: { code: 'BATCH_FAILED', message: 'Batch translation failed' } },
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
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request body' } },
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
        const { getDb } = await import('@repo/db');
        const schemas = await import('@repo/db/schemas');
        const { eq } = await import('drizzle-orm');

        const db = getDb();
        const tableMap: Record<string, any> = {
            accommodation: schemas.accommodations,
            destination: schemas.destinations,
            event: schemas.events,
            post: schemas.posts
        };

        const i18nColumnMap: Record<string, Record<string, string>> = {
            accommodation: {
                name: 'nameI18n',
                summary: 'summaryI18n',
                description: 'descriptionI18n',
                richDescription: 'richDescriptionI18n'
            },
            destination: {
                name: 'nameI18n',
                summary: 'summaryI18n',
                description: 'descriptionI18n'
            },
            event: {
                name: 'nameI18n',
                summary: 'summaryI18n',
                description: 'descriptionI18n'
            },
            post: {
                title: 'titleI18n',
                summary: 'summaryI18n',
                content: 'contentI18n'
            }
        };

        const table = tableMap[entityType];
        const i18nCols = i18nColumnMap[entityType];
        const i18nColumn = i18nCols?.[fieldType];

        if (!i18nColumn) {
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

        const [entity] = await db
            .select()
            .from(table)
            .where(eq(table.id, entityId))
            .limit(1);

        if (!entity) {
            return c.json(
                { success: false, error: { code: 'NOT_FOUND', message: `${entityType} not found` } },
                404
            );
        }

        const existingI18n = (entity[i18nColumn] as Record<string, string> | null) ?? {
            es: '',
            en: '',
            pt: ''
        };
        const updatedI18n = {
            es: existingI18n.es ?? '',
            en: locale === 'en' ? value : (existingI18n.en ?? ''),
            pt: locale === 'pt' ? value : (existingI18n.pt ?? '')
        };

        const existingMeta = (entity.translationMeta as Record<string, Record<string, Record<string, unknown>>> | null) ?? {};
        const fieldMeta = (existingMeta[fieldType] ?? {}) as Record<string, Record<string, unknown>>;
        const localeMeta = (fieldMeta[locale] ?? {}) as Record<string, unknown>;

        const updatedMeta = {
            ...existingMeta,
            [fieldType]: {
                ...fieldMeta,
                [locale]: {
                    ...localeMeta,
                    autoTranslated: false,
                    translatedAt: new Date().toISOString()
                }
            }
        };

        await db
            .update(table)
            .set({
                [i18nColumn]: updatedI18n,
                translationMeta: updatedMeta
            } as any)
            .where(eq(table.id, entityId));

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
            { success: false, error: { code: 'OVERRIDE_FAILED', message: 'Manual override failed' } },
            500
        );
    }
});
