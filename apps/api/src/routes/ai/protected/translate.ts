/**
 * AI content translation route (SPEC-212).
 *
 * Mounted at `POST /api/v1/protected/ai/translate` by the protected-AI barrel.
 * Translates a single content entity's text fields from Spanish to English
 * and Portuguese using the `translate` AI feature.
 *
 * ## Middleware order
 *
 *   auth → entitlement → rateLimit-perUser → rateLimit-perIP → quota
 *
 * @module apps/api/routes/ai/protected/translate
 */

import { z } from 'zod';
import type { AiFeature } from '@repo/schemas';
import { createAiQuotaMiddleware } from '../../../middlewares/ai-quota';
import { createAiRateLimitMiddlewares } from '../../../middlewares/ai-rate-limit';
import { entitlementMiddleware } from '../../../middlewares/entitlement';
import {
    translateEntity,
    persistTranslations,
    type TranslatableEntityType
} from '../../../services/ai-translate.service';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createRouter } from '../../../utils/create-app';
import { protectedAuthMiddleware } from '../../../middlewares/authorization';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FEATURE: AiFeature = 'translate';

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const TranslateRequestSchema = z.object({
    entityType: z.enum(['accommodation', 'destination', 'event', 'post']),
    entityId: z.string().uuid(),
    targetLocales: z.array(z.enum(['en', 'pt'])).optional()
}).strict();

type TranslateRequest = z.infer<typeof TranslateRequestSchema>;

// ---------------------------------------------------------------------------
// Field config per entity type
// ---------------------------------------------------------------------------

const FIELD_CONFIG: Record<TranslatableEntityType, readonly string[]> = {
    accommodation: ['name', 'summary', 'description', 'richDescription'],
    destination: ['name', 'summary', 'description'],
    event: ['name', 'summary', 'description'],
    post: ['title', 'summary', 'content']
};

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const protectedAiTranslateRoute = createRouter();

// Apply middleware in correct order BEFORE the route handler
protectedAiTranslateRoute.use('/', protectedAuthMiddleware());
protectedAiTranslateRoute.use('/', entitlementMiddleware());
const rateLimitMws = createAiRateLimitMiddlewares(FEATURE);
for (const mw of rateLimitMws) {
    protectedAiTranslateRoute.use('/', mw);
}
protectedAiTranslateRoute.use('/', createAiQuotaMiddleware(FEATURE));

protectedAiTranslateRoute.post('/', async (c) => {
    // Parse and validate body
    const rawBody = await c.req.json();
    const parseResult = TranslateRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
        return c.json(
            {
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid request body',
                    details: parseResult.error.issues
                }
            },
            400
        );
    }

    const { entityType, entityId, targetLocales } = parseResult.data;
    const actor = getActorFromContext(c);

    apiLogger.info(
        { userId: actor.id, entityType, entityId, targetLocales },
        'ai-translate: starting translation'
    );

    try {
        // Dynamic imports to avoid circular deps
        const { getDb } = await import('@repo/db');
        const schemas = await import('@repo/db/schemas');
        const { eq } = await import('drizzle-orm');

        const db = getDb();
        const tableMap: Record<TranslatableEntityType, any> = {
            accommodation: schemas.accommodations,
            destination: schemas.destinations,
            event: schemas.events,
            post: schemas.posts
        };

        const table = tableMap[entityType];
        const [entity] = await db
            .select()
            .from(table)
            .where(eq(table.id, entityId))
            .limit(1);

        if (!entity) {
            return c.json(
                {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: `${entityType} with id ${entityId} not found`
                    }
                },
                404
            );
        }

        // Extract translatable fields from the entity row
        const fields: Record<string, string> = {};
        const config = FIELD_CONFIG[entityType];
        for (const field of config) {
            const value = (entity as Record<string, unknown>)[field];
            if (typeof value === 'string' && value.trim().length > 0) {
                fields[field] = value;
            }
        }

        if (Object.keys(fields).length === 0) {
            return c.json(
                {
                    success: false,
                    error: {
                        code: 'NO_FIELDS',
                        message: `No translatable text fields found for ${entityType} ${entityId}`
                    }
                },
                400
            );
        }

        // Run translation
        const result = await translateEntity({
            entityType,
            entityId,
            fields,
            targetLocales: targetLocales as ('en' | 'pt')[] | undefined
        });

        // Persist results
        await persistTranslations(
            entityType,
            entityId,
            fields,
            result.translations,
            result.provider,
            result.model
        );

        return c.json({
            success: true,
            data: {
                entityId: result.entityId,
                translations: result.translations,
                totalTokens: result.totalTokens,
                provider: result.provider,
                model: result.model
            }
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        apiLogger.error(
            { userId: actor.id, entityType, entityId, error: errorMessage },
            'ai-translate: translation failed'
        );

        return c.json(
            {
                success: false,
                error: {
                    code: 'TRANSLATION_FAILED',
                    message: 'Translation failed. Spanish content was not modified.'
                }
            },
            500
        );
    }
});
