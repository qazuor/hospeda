/**
 * Accommodation import-from-URL route (SPEC-222 T-020).
 *
 * `POST /api/v1/protected/accommodations/import-from-url`
 *
 * Accepts an external listing URL, runs the stateless import pipeline
 * ({@link AccommodationImportService}), and returns a per-field draft for the
 * host to review before saving. Nothing is persisted here — the import is a
 * pure read/extract operation.
 *
 * ## Authorization (OR semantics)
 *
 * The route is for both NEW listings and EDITS, so a host may reach it with
 * either `ACCOMMODATION_CREATE`, `ACCOMMODATION_UPDATE_OWN`, or (admins)
 * `ACCOMMODATION_UPDATE_ANY`. `createProtectedRoute.requiredPermissions` uses
 * AND semantics (`hasAllPermissions`), which cannot express this OR, so the
 * factory only enforces authentication and the handler performs the OR check
 * explicitly. (Documented in `docs/billing/endpoint-gate-matrix.md`.)
 *
 * ## Legal confirmation (defense-in-depth)
 *
 * `AccommodationImportRequestSchema` already requires `legalConfirmed: true`
 * (the factory rejects anything else with 400). The handler re-asserts it
 * server-side so the guarantee does not depend solely on schema wiring.
 *
 * ## Rate limit
 *
 * A per-user sliding window of `HOSPEDA_IMPORT_RATE_LIMIT_RPH` requests/hour
 * (default 10) returns 429 + `Retry-After` on excess.
 *
 * ## AI quota (Strategy B only — degrade-clean)
 *
 * Strategy B (AI-assisted extraction) only runs for sparse generic pages. The
 * AI entitlement/quota gate is therefore applied lazily INSIDE the injected
 * `aiExtract` port — not as a blanket route middleware — so imports from
 * official APIs (Airbnb/Booking/Google/MercadoLibre) and JSON-LD-rich pages
 * are never blocked for hosts on AI-less plans. When the host lacks the
 * `accommodation_import` entitlement or has exhausted the monthly quota, the
 * port returns `null` (the pipeline degrades to a structured-only partial) and
 * the handler appends an informational notice so the host knows AI extraction
 * was skipped for plan/quota reasons. Successful AI calls are metered via
 * `recordAiUsage` so the monthly quota actually increments.
 *
 * @module apps/api/routes/accommodation/protected/import-from-url
 */

import type { AiService } from '@repo/ai-core';
import { getMonthlyCallCount, recordAiUsage } from '@repo/ai-core';
import {
    type AccommodationImportRequest,
    type AiFeature,
    type LanguageEnum,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { AccommodationImportRequestSchema, AccommodationImportResponseSchema } from '@repo/schemas';
import {
    AccommodationImportService,
    type ImportContext,
    type RawExtraction,
    ServiceError
} from '@repo/service-core';
import type { Actor } from '@repo/service-core';
import type { Context } from 'hono';
import { getPostHogClient } from '../../../lib/posthog';
import { AI_ENTITLEMENT_BY_FEATURE, AI_LIMIT_BY_FEATURE } from '../../../middlewares/ai-quota';
import {
    entitlementMiddleware,
    getRemainingLimit,
    hasEntitlement
} from '../../../middlewares/entitlement';
import { createSlidingWindowPerUserRateLimit } from '../../../middlewares/rate-limit';
import { createConfiguredAiService } from '../../../services/ai-service.factory';
import { getActorFromContext } from '../../../utils/actor';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';
import {
    type AccommodationImportAiOutput,
    AccommodationImportAiOutputSchema,
    type AiGateState,
    applyAiGateNotice,
    buildImportAiPrompt,
    mapAiOutputToRawExtraction
} from './import-from-url.ai';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** AI feature key for prompt resolution, provider routing, and quota metering. */
const FEATURE: AiFeature = 'accommodation_import';

/** Locale applied when the request omits one (Argentine market default). */
const DEFAULT_LOCALE: LanguageEnum = 'es';

/** One hour, in milliseconds — the rate-limit window. */
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/**
 * Extracts just the hostname from a URL for analytics, never the full URL
 * (which may carry tokens/PII). Returns `'invalid'` when unparseable.
 */
function safeHostname(rawUrl: string): string {
    try {
        return new URL(rawUrl).hostname;
    } catch {
        return 'invalid';
    }
}

/**
 * Zod-version-bridged parameter type for `AiService.generateObject`'s second
 * argument. `@repo/schemas` and `@repo/ai-core` pin the same Zod major but pnpm
 * may resolve them to different patch versions, producing a nominal `ZodType`
 * mismatch. The runtime schema is structurally identical and the explicit
 * `safeParse` below enforces the contract. Mirrors the cast in `search-chat.ts`.
 */
type GenerateObjectSchema = Parameters<AiService['generateObject']>[1];

// ---------------------------------------------------------------------------
// AI port builder
// ---------------------------------------------------------------------------

/**
 * Builds the `aiExtract` port wired with the lazy AI entitlement/quota gate.
 *
 * The returned function is invoked by `GenericAdapter` ONLY when Strategy B is
 * needed (sparse structured extraction). It:
 *   1. Degrades silently if billing context failed to load (cannot account for
 *      the spend) — no host-facing blame.
 *   2. Sets `gate.blockedReason` and returns `null` when the host lacks the
 *      `accommodation_import` entitlement or the monthly quota is exhausted.
 *   3. Otherwise calls the AI provider, meters the successful call, and maps the
 *      structured output into a {@link RawExtraction}.
 *   4. Returns `null` (degrading) on any provider/model error — that is a
 *      server-side condition, not the host's plan.
 *
 * @param deps - The Hono context, the authenticated actor, and the gate flag.
 * @returns The `aiExtract` port for {@link ImportContext}.
 */
export function buildImportAiExtract(deps: {
    c: Context;
    actor: Actor;
    gate: AiGateState;
}): (input: { text: string; locale?: string }) => Promise<RawExtraction | null> {
    const { c, actor, gate } = deps;

    return async ({ text, locale }) => {
        // 1. Cannot verify billing → do not spend AI we cannot account for.
        if (c.get('billingLoadFailed')) {
            return null;
        }

        // 2a. Entitlement gate (degrade clean + inform the host).
        if (!hasEntitlement(c, AI_ENTITLEMENT_BY_FEATURE[FEATURE])) {
            gate.blockedReason = 'entitlement';
            return null;
        }

        // 2b. Plan limit value: 0 = disabled, -1 = unlimited, N = monthly cap.
        // limit === 0 means the entitlement is present but the plan grants zero
        // AI imports — from the host's point of view their plan does not enable
        // AI extraction, so the entitlement notice ("not included in your plan")
        // is the correct user-facing message (same as lacking the entitlement).
        const limit = getRemainingLimit(c, AI_LIMIT_BY_FEATURE[FEATURE]);
        if (limit === 0) {
            gate.blockedReason = 'entitlement';
            return null;
        }

        // 2c. Monthly quota check (skip the count query when unlimited).
        if (limit !== -1) {
            const count = await getMonthlyCallCount({
                userId: actor.id,
                feature: FEATURE,
                now: new Date()
            });
            if (count >= limit) {
                gate.blockedReason = 'quota';
                return null;
            }
        }

        // 3. Cleared to call the model.
        const startedAt = Date.now();
        try {
            const aiService = await createConfiguredAiService();
            const outputSchema =
                AccommodationImportAiOutputSchema as unknown as GenerateObjectSchema;
            const result = await aiService.generateObject(
                {
                    feature: FEATURE,
                    prompt: buildImportAiPrompt(text),
                    locale: (locale as LanguageEnum) ?? DEFAULT_LOCALE
                },
                outputSchema
            );

            const parsed = AccommodationImportAiOutputSchema.safeParse(result.object);
            if (!parsed.success) {
                return null;
            }

            // Meter the successful call so the monthly quota actually increments.
            try {
                await recordAiUsage({
                    userId: actor.id,
                    feature: FEATURE,
                    provider: result.provider,
                    model: result.model,
                    promptTokens: result.usage.promptTokens,
                    completionTokens: result.usage.completionTokens,
                    latencyMs: Date.now() - startedAt,
                    status: 'success'
                });
            } catch (meterErr) {
                apiLogger.warn(
                    { err: meterErr instanceof Error ? meterErr.message : String(meterErr) },
                    'import-from-url: failed to record AI usage (extraction continues)'
                );
            }

            return mapAiOutputToRawExtraction(parsed.data as AccommodationImportAiOutput);
        } catch (err) {
            // Provider unconfigured / model error — degrade silently (not a plan issue).
            apiLogger.warn(
                { err: err instanceof Error ? err.message : String(err) },
                'import-from-url: AI extraction failed, degrading to structured-only'
            );
            return null;
        }
    };
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

/**
 * Protected route: `POST /api/v1/protected/accommodations/import-from-url`.
 *
 * `requiredPermissions` is intentionally omitted — the create/update OR check
 * is done in the handler (the factory's AND semantics cannot express it).
 */
export const protectedImportFromUrlRoute = createProtectedRoute({
    method: 'post',
    path: '/import-from-url',
    summary: 'Import accommodation data from an external URL',
    description:
        'Extracts structured accommodation data from an external listing URL and returns a ' +
        'per-field draft (with confidence + source) for the host to review before saving. ' +
        'Stateless — nothing is persisted. Reviews and ratings are never returned. ' +
        'AI-assisted extraction (for sparse pages) is gated by the accommodation_import ' +
        'entitlement and monthly quota; lacking it degrades to a structured-only partial.',
    tags: ['Accommodations'],
    requestBody: AccommodationImportRequestSchema,
    responseSchema: AccommodationImportResponseSchema,
    // Stateless read/extract — nothing is created, so respond 200 (not POST's default 201).
    successStatusCode: 200,
    options: {
        middlewares: [
            // Load entitlements/limits/billingLoadFailed so the lazy AI gate can read them.
            entitlementMiddleware(),
            // Per-user 10/h (configurable) sliding window → 429 + Retry-After on excess.
            createSlidingWindowPerUserRateLimit({
                windowMs: RATE_LIMIT_WINDOW_MS,
                max: env.HOSPEDA_IMPORT_RATE_LIMIT_RPH,
                keyPrefix: 'import-from-url'
            })
        ]
    },
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        // Authorization: create OR update.own OR update.any (OR semantics).
        const canImport =
            actor.permissions.includes(PermissionEnum.ACCOMMODATION_CREATE) ||
            actor.permissions.includes(PermissionEnum.ACCOMMODATION_UPDATE_OWN) ||
            actor.permissions.includes(PermissionEnum.ACCOMMODATION_UPDATE_ANY);
        if (!canImport) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: importing accommodation data requires create or update permission.'
            );
        }

        const input = body as AccommodationImportRequest;

        // Defense-in-depth: re-assert the legal confirmation server-side (AC-1).
        if (input.legalConfirmed !== true) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'You must confirm you have the right to import this listing before continuing.'
            );
        }

        const locale = input.locale ?? DEFAULT_LOCALE;
        const gate: AiGateState = { blockedReason: null };

        const context: ImportContext = {
            locale,
            timeoutMs: env.HOSPEDA_IMPORT_FETCH_TIMEOUT_MS,
            maxBytes: env.HOSPEDA_IMPORT_FETCH_MAX_BYTES,
            aiMaxChars: env.HOSPEDA_IMPORT_AI_MAX_CHARS,
            credentials: {
                apifyToken: env.HOSPEDA_APIFY_TOKEN,
                apifyAirbnbActor: env.HOSPEDA_APIFY_AIRBNB_ACTOR,
                apifyBookingActor: env.HOSPEDA_APIFY_BOOKING_ACTOR,
                googlePlacesApiKey: env.HOSPEDA_GOOGLE_PLACES_API_KEY,
                mercadoLibreToken: env.HOSPEDA_MERCADOLIBRE_TOKEN
            },
            aiExtract: buildImportAiExtract({ c: ctx, actor, gate })
        };

        // Ephemeral, fire-and-forget analytics (no DB). No-op when PostHog is
        // disabled. Only the hostname is sent — never the full URL (may carry
        // tokens/PII).
        const sourceHost = safeHostname(input.url);
        getPostHogClient()?.capture({
            distinctId: actor.id,
            event: 'accommodation_import_started',
            properties: { host: sourceHost }
        });

        const service = new AccommodationImportService({ logger: apiLogger });
        const response = await service.importFromUrl({ url: input.url, locale, context }, actor);
        const final = applyAiGateNotice(response, gate);

        getPostHogClient()?.capture({
            distinctId: actor.id,
            event:
                final.source === 'none'
                    ? 'accommodation_import_failed'
                    : 'accommodation_import_completed',
            properties: {
                host: sourceHost,
                source: final.source,
                partial: final.partial,
                methodsUsed: final.methodsUsed.length,
                aiBlocked: gate.blockedReason
            }
        });

        return final;
    }
});
