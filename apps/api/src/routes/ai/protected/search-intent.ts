/**
 * AI NL search-intent route module (SPEC-199 §5.1, §5.5).
 *
 * ## What lives here
 *
 * - `buildSearchIntentPrompt` — pure helper that produces the per-request
 *   `prompt` string passed to `aiService.generateObject({ feature: 'search' })`.
 *   It embeds the locale-specific amenity slug list, the locale-specific feature
 *   slug list, and the user query. The engine prepends `DEFAULT_PROMPTS['search']`
 *   (the static slot-extraction contract) automatically — this helper provides
 *   ONLY the dynamic context.
 *
 * - `searchIntentRoute` — `POST /` handler registered in the protected-AI barrel
 *   at `apps/api/src/routes/ai/protected/index.ts`, mounted under
 *   `/api/v1/protected/ai/search-intent`. Added by T-010.
 *
 * ## Handler flow (§5.1)
 *
 * 1. `AiSearchIntentRequestSchema` validated by the factory.
 * 2. `createConfiguredAiService()` — new instance per request (no module singleton).
 * 3. `generateObject` with `SearchIntentOutputSchema` as the output schema.
 * 4. `.safeParse` the returned `entities` — on failure, treat as `{}` + confidence 0.
 * 5. Resolve `amenitySlugs` → UUIDs (single DB query, T-011).
 * 6. Resolve `featureSlugs` → UUIDs (single DB query, T-011).
 * 7. `mapIntentToSearchParams(validatedEntities, resolvedAmenityIds, resolvedFeatureIds)`.
 * 8. `fallbackToKeyword = confidence < 0.5`.
 * 9. Return `{ intent, mappedParams, confidence, fallbackToKeyword }`.
 *
 * ## Error mapping
 *
 * AI engine errors (`AiEngineError`, `AiFeatureNotConfiguredError`) are caught
 * inside the handler, mapped via `mapAiEngineErrorToHttpStatus`, and returned
 * as a `Response` directly (the `createCRUDRoute` factory passes through any
 * handler return value that is a `Response` instance unchanged).
 *
 * @module apps/api/routes/ai/protected/search-intent
 */

import type { AiService } from '@repo/ai-core';
import { amenities, features, getDb, inArray } from '@repo/db';
import {
    type AiSearchIntentRequest,
    AiSearchIntentRequestSchema,
    AiSearchIntentResponseDataSchema,
    type SearchIntentEntities,
    SearchIntentEntitiesSchema,
    type SearchIntentOutput,
    SearchIntentOutputSchema
} from '@repo/schemas';
import type { Context } from 'hono';
import { createAiRateLimitMiddlewares } from '../../../middlewares/ai-rate-limit.js';
import { entitlementMiddleware } from '../../../middlewares/entitlement.js';
import { createConfiguredAiService } from '../../../services/ai-service.factory.js';
import { mapAiEngineErrorToHttpStatus } from '../../../utils/ai-error-mapper.js';
import { apiLogger } from '../../../utils/logger.js';
import { createErrorResponse } from '../../../utils/response-helpers.js';
import { createProtectedRoute } from '../../../utils/route-factory.js';
import { AMENITY_ALLOWLIST, FEATURE_ALLOWLIST } from './amenity-allowlist.js';
import { mapIntentToSearchParams } from './search-intent.mapper.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Default locale applied when the request body omits `locale`.
 * Mirrors the engine default (also 'es') but makes the fallback auditable
 * at the route boundary.
 */
const DEFAULT_LOCALE = 'es' as const;

// ─── Prompt builder ───────────────────────────────────────────────────────────

/**
 * Builds the per-request `prompt` string for
 * `aiService.generateObject({ feature: 'search', prompt, locale })`.
 *
 * The AI engine automatically prepends `DEFAULT_PROMPTS['search']` (the full
 * slot-extraction contract from `packages/ai-core`) as the system context before
 * this string. This helper therefore provides ONLY the dynamic per-request
 * context:
 *
 * 1. A line listing the allowed amenity slugs for the given locale
 *    (de-duplicated unique values from `AMENITY_ALLOWLIST[locale]`).
 * 2. A line listing the allowed feature slugs for the given locale
 *    (de-duplicated unique values from `FEATURE_ALLOWLIST[locale]`).
 * 3. A blank separator line.
 * 4. The raw user query, quoted in triple double-quotes for unambiguous parsing.
 *
 * If `locale` is not a recognised key in the allowlist dictionaries the helper
 * falls back silently to the `'es'` (Spanish) dictionary.
 *
 * @param query  - Raw user NL query (already validated against max 500 chars).
 * @param locale - User locale; controls which allowlist dictionary is selected.
 * @returns Prompt string ready to pass as `prompt` to `generateObject`.
 *
 * @example
 * ```ts
 * const prompt = buildSearchIntentPrompt({ query: 'cabaña con pileta', locale: 'es' });
 * // Starts with:
 * // "Allowed amenity slugs for this request …: pool, wifi, bbq, …"
 * // "Allowed feature slugs for this request …: river_front, …"
 * // ""
 * // "User query: """cabaña con pileta""""
 * ```
 */
export function buildSearchIntentPrompt({
    query,
    locale
}: {
    readonly query: string;
    readonly locale: 'es' | 'en' | 'pt';
}): string {
    const amenityDict = (AMENITY_ALLOWLIST[locale] ?? AMENITY_ALLOWLIST.es) as Readonly<
        Record<string, string>
    >;
    const amenitySlugs = [...new Set(Object.values(amenityDict))].join(', ');

    const featureDict = (FEATURE_ALLOWLIST[locale] ?? FEATURE_ALLOWLIST.es) as Readonly<
        Record<string, string>
    >;
    const featureSlugs = [...new Set(Object.values(featureDict))].join(', ');

    return [
        `Allowed amenity slugs for this request (match user mentions to these; ignore any amenity not in this list): ${amenitySlugs}`,
        `Allowed feature slugs for this request (environment/atmosphere/aptitude/style only; match user mentions to these; ignore any feature not in this list): ${featureSlugs}`,
        '',
        `User query: """${query}"""`
    ].join('\n');
}

// ─── Slug → UUID resolution helpers ──────────────────────────────────────────

/**
 * Resolves amenity slugs to UUIDs via a single DB query.
 *
 * Returns an empty array when `slugs` is empty (skips the DB round-trip).
 * Unknown slugs are silently ignored — only rows that match are returned.
 *
 * @param slugs - Amenity slug identifiers from the validated entities.
 * @returns Array of UUID strings for the matching amenity rows.
 */
async function resolveAmenityIds(slugs: readonly string[]): Promise<string[]> {
    if (slugs.length === 0) {
        return [];
    }
    const db = getDb();
    const rows = await db
        .select({ id: amenities.id })
        .from(amenities)
        .where(inArray(amenities.slug, [...slugs]));
    return rows.map((r) => r.id);
}

/**
 * Resolves feature slugs to UUIDs via a single DB query.
 *
 * Returns an empty array when `slugs` is empty (skips the DB round-trip).
 * Unknown slugs are silently ignored — only rows that match are returned.
 *
 * @param slugs - Feature slug identifiers from the validated entities.
 * @returns Array of UUID strings for the matching feature rows.
 */
async function resolveFeatureIds(slugs: readonly string[]): Promise<string[]> {
    if (slugs.length === 0) {
        return [];
    }
    const db = getDb();
    const rows = await db
        .select({ id: features.id })
        .from(features)
        .where(inArray(features.slug, [...slugs]));
    return rows.map((r) => r.id);
}

// ─── Route ────────────────────────────────────────────────────────────────────

/**
 * Protected route: `POST /api/v1/protected/ai/search-intent`.
 *
 * Converts a free-form natural-language accommodation search query into
 * structured filter parameters via `aiService.generateObject`.
 *
 * ## Governance model (SPEC-211 Phase 3 — §7.7)
 *
 * `ai_search` is a **platform feature**, not a per-plan billing entitlement.
 * The route is:
 *
 * - Authenticated-only (handled by the factory's `protectedAuthMiddleware`).
 * - Rate-limited by `createAiRateLimitMiddlewares('search')` (per-user + per-IP
 *   burst guard).
 * - Cost-backstopped by the `ai_settings` per-feature USD ceiling for
 *   `feature: 'search'` (`perFeatureMonthlyMicroUsd.search` = 30_000_000 µUSD /
 *   USD 30) enforced by the engine ceiling checker
 *   (`packages/ai-core/src/usage/ceiling.ts`). The global ceiling
 *   (100_000_000 µUSD / USD 100) also applies. Both run inside
 *   `createConfiguredAiService()` — NOT as a middleware.
 * - Metered via `recordAiUsage` (for cost visibility), also inside the engine.
 *
 * `createAiQuotaMiddleware('search')` is intentionally absent: there is no
 * per-plan `AI_SEARCH` entitlement gate or `MAX_AI_SEARCH_PER_MONTH` quota
 * gate on this route (SPEC-211 §7.7). `AI_SEARCH` and `MAX_AI_SEARCH_PER_MONTH`
 * are retained in their respective enums (additive-only enum policy) but no
 * longer granted by any plan.
 *
 * Middleware order:
 *
 *   auth (injected by factory) → entitlement (loads context) → rateLimit-perUser → rateLimit-perIP
 *
 * `entitlementMiddleware` runs first so billing context is always populated for
 * any downstream middleware or handler that may inspect it. It does NOT gate
 * `AI_SEARCH` — gating is done solely by auth + rate-limit.
 */
export const searchIntentRoute = createProtectedRoute({
    method: 'post',
    path: '/',
    summary: 'Extract search intent from natural language',
    description:
        'Converts a free-form natural-language accommodation search query into structured filter parameters. ' +
        'Platform-governed: requires authentication and is subject to per-user/IP rate limits and a USD cost ceiling. ' +
        'Not gated by a billing entitlement or per-plan monthly quota (SPEC-211 §7.7).',
    tags: ['AI Search'],
    requestBody: AiSearchIntentRequestSchema,
    responseSchema: AiSearchIntentResponseDataSchema,
    // Extraction/compute endpoint — it creates NO resource, so return 200 OK
    // (not the POST-default 201 Created). Matches spec §5.1/§8.2 and the
    // media upload routes which override the same way.
    successStatusCode: 200,
    options: {
        middlewares: [
            // Layer 0: load billing context into Hono context vars (entitlements, limits,
            // billingLoadFailed). Does NOT gate AI_SEARCH — search is platform-governed.
            // Runs first so downstream middleware / handler always has a populated context.
            entitlementMiddleware(),
            // Layer 1: burst control (perUser + perIP sliding-window rate limits).
            // These are the only access guards for this platform feature.
            ...createAiRateLimitMiddlewares('search')
            // NOTE: createAiQuotaMiddleware('search') is intentionally omitted.
            // ai_search is a free platform feature (SPEC-211 Phase 3 §7.7). The USD
            // cost ceiling and metering are enforced inside the AI engine, not here.
        ]
    },
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        // Step 1: Cast the already-validated body (validated by the factory via
        // AiSearchIntentRequestSchema before the handler is called).
        const { query, locale: rawLocale } = body as AiSearchIntentRequest;
        const locale = rawLocale ?? DEFAULT_LOCALE;

        try {
            // Step 2: Obtain a fresh AiService instance — one per request, no singleton.
            const aiService = await createConfiguredAiService();

            // Step 3: Generate the structured search intent from the NL query.
            //
            // Cast SearchIntentOutputSchema to the parameter type that ai-service's
            // generateObject expects. Both @repo/schemas and @repo/ai-core pin zod
            // `^4.0.8`, but pnpm may resolve them to slightly different patch versions
            // (4.3.x vs 4.4.x), producing a nominal ZodType mismatch that is safe to
            // bypass — the runtime schemas are identical and the structural contract
            // (confidence + entities) is enforced by the safeParse in step 4.
            type GenerateObjectSchema = Parameters<AiService['generateObject']>[1];
            const outputSchema = SearchIntentOutputSchema as unknown as GenerateObjectSchema; // TYPE-WORKAROUND: pnpm may resolve @repo/schemas and @repo/ai-core to different Zod patch versions (4.3.x vs 4.4.x), causing a nominal ZodType mismatch; the runtime schemas are structurally identical and step 4's safeParse enforces the contract.
            const result = await aiService.generateObject(
                {
                    feature: 'search',
                    prompt: buildSearchIntentPrompt({ query, locale }),
                    locale
                },
                outputSchema
            );

            // Step 4: Extract entities + confidence; safeParse entities to guard against
            // model output that partially matches the schema. On failure, treat as
            // empty entities with confidence 0 (forces fallbackToKeyword: true).
            //
            // `result.object` is typed as `unknown` because the zod version cast above
            // loses the generic type parameter. We re-assert it as `SearchIntentOutput`
            // — the safeParse on `entities` in the next step provides the actual runtime
            // safety guarantee.
            const typedObject = result.object as SearchIntentOutput;
            const rawEntities = typedObject.entities;
            let confidence = typedObject.confidence;

            const entitiesParse = SearchIntentEntitiesSchema.safeParse(rawEntities);
            let validatedEntities: SearchIntentEntities;
            if (entitiesParse.success) {
                validatedEntities = entitiesParse.data;
            } else {
                apiLogger.warn(
                    { query, locale, issues: entitiesParse.error.issues },
                    'search-intent: entities safeParse failed — falling back to empty entities'
                );
                validatedEntities = {};
                confidence = 0;
            }

            // Steps 5 & 6 (T-011): Resolve amenity and feature slugs to DB UUIDs.
            // The two lookups are independent — run them in parallel.
            const amenitySlugIds = validatedEntities.amenitySlugs ?? [];
            const featureSlugIds = validatedEntities.featureSlugs ?? [];

            const [resolvedAmenityIds, resolvedFeatureIds] = await Promise.all([
                resolveAmenityIds(amenitySlugIds),
                resolveFeatureIds(featureSlugIds)
            ]);

            // Step 7: Map validated intent to URL-ready AccommodationSearchHttp params.
            const mappedParams = mapIntentToSearchParams(
                validatedEntities,
                resolvedAmenityIds,
                resolvedFeatureIds
            );

            // Step 8: Determine fallback flag.
            const fallbackToKeyword = confidence < 0.5;

            // Step 9: Build the AiIntent envelope for the response.
            const intent = {
                kind: 'search',
                confidence,
                entities: validatedEntities,
                rawQuery: query
            };

            return {
                intent,
                mappedParams,
                confidence,
                fallbackToKeyword
            };
        } catch (error) {
            // Map AI engine / config errors to the correct HTTP status + code
            // before they reach handleRouteError (which would emit a generic 500).
            const aiMapping = mapAiEngineErrorToHttpStatus(error);
            if (aiMapping) {
                apiLogger.warn(
                    { query, locale, code: aiMapping.code, status: aiMapping.status },
                    'search-intent: AI engine error'
                );
                return createErrorResponse(
                    { code: aiMapping.code, message: aiMapping.code },
                    ctx,
                    aiMapping.status
                );
            }
            // Non-AI errors (DB failures, unexpected throws) propagate to the
            // factory's handleRouteError fallback.
            throw error;
        }
    }
});
