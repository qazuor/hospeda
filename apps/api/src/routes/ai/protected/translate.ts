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

import type { AiFeature } from '@repo/schemas';
import { z } from 'zod';
import { createAiQuotaMiddleware } from '../../../middlewares/ai-quota';
import { createAiRateLimitMiddlewares } from '../../../middlewares/ai-rate-limit';
import { protectedAuthMiddleware } from '../../../middlewares/authorization';
import { entitlementMiddleware } from '../../../middlewares/entitlement';
import {
    loadTranslatableFields,
    loadTranslationEntityOwnership,
    persistTranslations,
    translateEntity
} from '../../../services/ai-translate.service';
import { getActorFromContext } from '../../../utils/actor';
import { meterAiUsage } from '../../../utils/ai-usage-metering';
import { createRouter } from '../../../utils/create-app';
import { apiLogger } from '../../../utils/logger';
import { mayTranslateEntity, PROTECTED_TRANSLATABLE_ENTITY_TYPES } from './translate.authorization';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FEATURE: AiFeature = 'translate';

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const TranslateRequestSchema = z
    .object({
        // Derived from the authorization module's list, never re-typed here:
        // an accepted entity type must always have a rule saying who may write
        // it (HOS-584).
        entityType: z.enum(PROTECTED_TRANSLATABLE_ENTITY_TYPES),
        entityId: z.string().uuid(),
        // Locale the host is editing in; translations flow OUT of it. Defaults
        // to Spanish for backward compatibility.
        sourceLocale: z.enum(['es', 'en', 'pt']).default('es'),
        // When omitted, the service fills every locale except the source that is
        // still missing a value.
        targetLocales: z.array(z.enum(['es', 'en', 'pt'])).optional()
    })
    .strict();

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
    const handlerStartMs = Date.now();

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

    const { entityType, entityId, sourceLocale, targetLocales } = parseResult.data;
    const actor = getActorFromContext(c);

    apiLogger.info(
        { userId: actor.id, entityType, entityId, sourceLocale, targetLocales },
        'ai-translate: starting translation'
    );

    /**
     * Provider spend that has been incurred but not yet written to `ai_usage`,
     * because the request has not been confirmed as delivered. Set once the
     * provider calls succeed and cleared once the row is written — the catch
     * below records whatever is still pending as `status: 'error'` so a failed
     * request keeps its cost visible without consuming the caller's quota.
     */
    let unbilledSpend: {
        provider: string;
        model: string;
        promptTokens: number;
        completionTokens: number;
    } | null = null;

    /** The 404 this route answers for anything the caller may not translate. */
    const notFound = () =>
        c.json(
            {
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: `${entityType} with id ${entityId} not found`
                }
            },
            404
        );

    try {
        // HOS-584: authorize BEFORE loading or translating anything. This route
        // takes the target row's id from the request BODY, so nothing upstream
        // can check it — `ownershipMiddleware` reads `c.req.param(...)`, and the
        // auth / entitlement / quota middlewares only ever look at the actor.
        // Without this gate any authenticated user holding `AI_TRANSLATE` could
        // persist translations into another host's accommodation, or into staff
        // content, simply by knowing its id.
        //
        // A refused request answers 404, byte-identical to a genuinely missing
        // row, and never 403: a 403 would confirm the id exists, turning this
        // endpoint into an existence oracle over every content row in the
        // platform. Same rule as the host-trade routes (HOS-376).
        const ownership = await loadTranslationEntityOwnership(entityType, entityId);

        if (
            ownership === null ||
            !mayTranslateEntity({
                entityType,
                ownership,
                actorId: actor.id,
                actorPermissions: actor.permissions ?? []
            })
        ) {
            apiLogger.warn(
                { userId: actor.id, entityType, entityId, exists: ownership !== null },
                'ai-translate: refused — actor may not translate this entity'
            );
            return notFound();
        }

        const fields = await loadTranslatableFields(entityType, entityId, sourceLocale);

        if (fields === null) {
            return notFound();
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
            sourceLocale,
            targetLocales,
            onlyMissing: true
        });

        // -------------------------------------------------------------------
        // Usage metering (HOS-328). See `utils/ai-usage-metering` for why the
        // row exists at all and why the billing unit is the request.
        //
        // This is the widest fan-out of the metered features: `translateEntity`
        // makes one provider call per (field × target locale), so a single
        // request can be a dozen real calls, all summed into ONE row.
        //
        // A row is written only when a provider call actually delivered:
        //
        //   - Nothing was called. With `onlyMissing: true` an entity whose target
        //     locales are all already populated skips every pair and returns no
        //     translations. That is a successful no-op — the host simply clicked
        //     Translate twice. A row here would emit a permanent stream of bogus
        //     failures into the error-rate signal and a synthetic provider bucket
        //     in the usage report.
        //   - Calls were made and ALL of them failed. Also no row, but for a
        //     weaker reason: `translateFieldWithRetry` hard-codes 0 tokens on any
        //     caught error and `translateEntity` only accumulates inside its
        //     success branch, so the row we COULD write would always carry zero
        //     cost — no spend signal to gain. Known gap: that zero is what the
        //     code recorded, not necessarily what the provider billed. The engine
        //     runs output moderation AFTER generating, so a moderation-blocked
        //     translation was paid for and still reports 0. Propagating real usage
        //     out of failed calls needs a service-layer change and is tracked
        //     separately; the per-field failures are logged by the service today.
        //   - Calls were made and at least one delivered → metered as 'success',
        //     but only AFTER persistence, so the caller is never charged a quota
        //     unit for a request that visibly 500s. HOS-190's Zod gate rejects
        //     malformed provider output deterministically, so charging before
        //     persisting would burn the whole monthly quota on retries of the
        //     same entity. The catch below still records the spend as 'error'.
        //
        // (The sibling `search-chat` route meters CONCURRENTLY with its
        // persistence step, without gating on it. That is not an inconsistency:
        // the ordering follows "did the caller already receive value?" — there the
        // reply has already been streamed, so persistence cannot change the
        // verdict; here a persistence failure means the caller gets a 500 and
        // nothing else, so the verdict depends on it.)
        //
        // Note the aggregate is priced at the LAST successful call's
        // provider/model (`translateEntity` keeps that one), so a mid-request
        // fallback prices earlier calls at the final provider's rate.
        // -------------------------------------------------------------------
        const anyProviderCallSucceeded = result.translations.some(
            (translation) => translation.success
        );

        if (anyProviderCallSucceeded) {
            // Hold the row until persistence confirms the request actually
            // delivered. The catch below downgrades it to 'error' if persistence
            // throws, so the spend stays visible either way.
            unbilledSpend = {
                provider: result.provider || 'unknown',
                model: result.model || 'unknown',
                promptTokens: result.promptTokens,
                completionTokens: result.completionTokens
            };
        }

        // Persist results
        await persistTranslations(
            entityType,
            entityId,
            fields,
            result.translations,
            result.provider,
            result.model,
            sourceLocale
        );

        if (unbilledSpend) {
            // Cleared BEFORE the await: if metering ever threw despite its
            // non-throwing contract, a still-populated `unbilledSpend` would make
            // the catch below write a second row for the same request.
            const spend = unbilledSpend;
            unbilledSpend = null;

            await meterAiUsage({
                userId: actor.id,
                feature: FEATURE,
                ...spend,
                latencyMs: Date.now() - handlerStartMs,
                status: 'success',
                logContext: { entityType, entityId, sourceLocale }
            });
        }

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

        // HOS-328: the provider calls were already paid for even though the
        // request is about to 500. Record the spend as 'error' so it stays
        // visible to the cost ceiling, while `getMonthlyCallCount` (which counts
        // only 'success'/'fallback') leaves the caller's quota untouched — a
        // deterministic persistence failure must not burn a quota unit per retry.
        if (unbilledSpend) {
            const spend = unbilledSpend;
            unbilledSpend = null;

            await meterAiUsage({
                userId: actor.id,
                feature: FEATURE,
                ...spend,
                latencyMs: Date.now() - handlerStartMs,
                status: 'error',
                logContext: { entityType, entityId, sourceLocale }
            });
        }

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
