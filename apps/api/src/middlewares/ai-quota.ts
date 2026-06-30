/**
 * AI Quota Enforcement Middleware (SPEC-173 T-031).
 *
 * Provides a `createAiQuotaMiddleware` factory that enforces per-user,
 * per-feature, per-month AI call quotas before a request reaches the AI
 * route handler.
 *
 * **Required upstream middleware** (must be mounted BEFORE this factory's
 * output):
 *   - `protectedAuthMiddleware` — sets `c.get('actor')` to the authenticated
 *     user (rejects GUEST/unauthenticated requests with 401).
 *   - `entitlementMiddleware()` — sets `c.get('userEntitlements')`,
 *     `c.get('userLimits')`, and `c.get('billingLoadFailed')`.
 *
 * Both requirements are satisfied when using the route factories:
 *   - `createProtectedStreamingRoute` (streaming AI routes)
 *   - `createProtectedRoute` (non-streaming AI routes)
 *
 * **Enforcement flow**:
 *   1. Defensive: actor missing or GUEST → 401.
 *   2. billingLoadFailed=true → 503 (billing service unavailable).
 *   3. Entitlement gate: user lacks `AI_<feature>` entitlement → 403
 *      ENTITLEMENT_REQUIRED with upgrade hint. Skipped when the middleware is
 *      created with `{ skipEntitlementGate: true }` (auth-baseline features
 *      such as `ai_search` — per-plan quota, no entitlement gate).
 *   4. Limit gate: plan limit value is 0 (feature disabled) → 403
 *      LIMIT_REACHED immediately (no DB query needed).
 *      Plan limit value is -1 (unlimited) → pass (skip DB count query).
 *   5. Quota check: `getMonthlyCallCount(userId, feature, now)` ≥ limit
 *      → meter the rejected attempt first (status 'quota_exceeded' row in
 *        ai_usage — AC-6), then throw 403 LIMIT_REACHED with current/max
 *        in details.  If metering fails, log and still reject (enforcement
 *        must NOT depend on metering success — AC-6 spec wording).
 *   6. Under limit → `await next()`.
 *
 * **Mapping constants** `AI_ENTITLEMENT_BY_FEATURE` and `AI_LIMIT_BY_FEATURE`
 * are exported so route code and tests can reference the same mapping without
 * duplicating it.
 *
 * @module middlewares/ai-quota
 */

import { getMonthlyCallCount, recordAiUsage } from '@repo/ai-core';
import { EntitlementKey, LimitKey } from '@repo/billing';
import type { AiFeature } from '@repo/schemas';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { MiddlewareHandler } from 'hono';
import type { AppBindings } from '../types';
import { isGuestActor } from '../utils/actor';
import { apiLogger } from '../utils/logger';
import { getRemainingLimit, hasEntitlement } from './entitlement';

// ---------------------------------------------------------------------------
// QuotaGatedAiFeature
// ---------------------------------------------------------------------------

/**
 * AI features that go through the protected-tier quota/entitlement middleware.
 *
 * Admin-tier features (e.g. `post_generate`) are excluded — they are
 * permission-gated only and the quota middleware is never mounted on their
 * routes. Exhaustive maps keyed by this type cover exactly the
 * protected-tier features without requiring new EntitlementKey / LimitKey
 * enum values for admin-only operations.
 */
export type QuotaGatedAiFeature = Exclude<AiFeature, 'post_generate'>;

// ---------------------------------------------------------------------------
// Feature → EntitlementKey mapping
// ---------------------------------------------------------------------------

/**
 * Maps each {@link AiFeature} to its corresponding {@link EntitlementKey}.
 *
 * The pattern is mechanical: `ai_${feature}` as an EntitlementKey enum value.
 * Exported so downstream consumers (routes, tests) can reference the same
 * mapping without duplicating it.
 */
export const AI_ENTITLEMENT_BY_FEATURE: Readonly<Record<QuotaGatedAiFeature, EntitlementKey>> = {
    text_improve: EntitlementKey.AI_TEXT_IMPROVE,
    chat: EntitlementKey.AI_CHAT,
    search: EntitlementKey.AI_SEARCH,
    support: EntitlementKey.AI_SUPPORT,
    translate: EntitlementKey.AI_TRANSLATE,
    accommodation_import: EntitlementKey.AI_ACCOMMODATION_IMPORT
} as const;

// ---------------------------------------------------------------------------
// Feature → LimitKey mapping
// ---------------------------------------------------------------------------

/**
 * Maps each {@link AiFeature} to its corresponding {@link LimitKey}.
 *
 * The pattern is mechanical: `max_ai_${feature}_per_month` as a LimitKey
 * enum value. Exported so downstream consumers (routes, tests) can reference
 * the same mapping without duplicating it.
 */
export const AI_LIMIT_BY_FEATURE: Readonly<Record<QuotaGatedAiFeature, LimitKey>> = {
    text_improve: LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH,
    chat: LimitKey.MAX_AI_CHAT_PER_MONTH,
    search: LimitKey.MAX_AI_SEARCH_PER_MONTH,
    support: LimitKey.MAX_AI_SUPPORT_PER_MONTH,
    translate: LimitKey.MAX_AI_TRANSLATE_PER_MONTH,
    accommodation_import: LimitKey.MAX_AI_ACCOMMODATION_IMPORT_PER_MONTH
} as const;

// ---------------------------------------------------------------------------
// createAiQuotaMiddleware
// ---------------------------------------------------------------------------

/**
 * Options for {@link createAiQuotaMiddleware}.
 */
export type AiQuotaMiddlewareOptions = {
    /**
     * When `true`, the entitlement gate (step 3) is skipped: the middleware
     * enforces only the per-plan monthly limit (steps 1/2/4/5) without
     * requiring the `AI_<feature>` entitlement.
     *
     * Use this for **auth-baseline** AI features — features available to every
     * authenticated user with a per-plan quota but NO plan entitlement gate.
     * `ai_search` is the canonical case (SPEC-283 OQ-1): no plan grants
     * `AI_SEARCH`, so without this flag the middleware would reject every
     * request with 403 ENTITLEMENT_REQUIRED.
     *
     * @defaultValue `false` (entitlement gate enforced — existing behavior).
     */
    readonly skipEntitlementGate?: boolean;
};

/**
 * Factory that creates an AI quota enforcement middleware for a specific
 * AI feature.
 *
 * Must be mounted AFTER `protectedAuthMiddleware` and `entitlementMiddleware()`
 * (both requirements are satisfied by the protected route factories
 * `createProtectedStreamingRoute` / `createProtectedRoute`).
 *
 * @param feature - The AI feature to enforce quota for (a
 *   {@link QuotaGatedAiFeature}).
 * @param options - Optional behavior overrides. Pass
 *   `{ skipEntitlementGate: true }` for auth-baseline features that have a
 *   per-plan quota but no entitlement gate (see {@link AiQuotaMiddlewareOptions}).
 * @returns A Hono {@link MiddlewareHandler} that enforces the quota for
 *   the given feature before calling `next()`.
 *
 * @example
 * ```ts
 * import { createAiQuotaMiddleware } from '../middlewares/ai-quota';
 *
 * // Inside createProtectedStreamingRoute options.middlewares:
 * const handler = createProtectedStreamingRoute({
 *   middlewares: [createAiQuotaMiddleware('text_improve')],
 *   streamHandler: async (c) => { ... },
 * });
 *
 * // Auth-baseline feature (per-plan quota, no entitlement gate):
 * createAiQuotaMiddleware('search', { skipEntitlementGate: true });
 * ```
 */
export function createAiQuotaMiddleware(
    feature: QuotaGatedAiFeature,
    options?: AiQuotaMiddlewareOptions
): MiddlewareHandler<AppBindings> {
    return async (c, next) => {
        // ----------------------------------------------------------------
        // Step 1: Defensive actor check.
        //
        // protectedAuthMiddleware normally rejects before we get here, but
        // we guard defensively — exactly as other middleware layers do (e.g.
        // limit-enforcement.ts:112-118). If actor is missing or is a GUEST,
        // return 401 immediately.
        // ----------------------------------------------------------------
        const actor = c.get('actor');

        if (!actor || !actor.id || isGuestActor(actor)) {
            throw new ServiceError(
                ServiceErrorCode.UNAUTHORIZED,
                'Autenticación requerida para acceder a funciones de inteligencia artificial.',
                {}
            );
        }

        // ----------------------------------------------------------------
        // Step 2: Billing load guard.
        //
        // When the billing service failed to load entitlements, the limits
        // map is empty. Returning 503 prevents false-positives (empty map
        // would make getRemainingLimit return -1 = "unlimited" for every key,
        // which is a privilege escalation during billing outages).
        // ----------------------------------------------------------------
        if (c.get('billingLoadFailed')) {
            return c.json(
                {
                    success: false,
                    error: {
                        code: 'SERVICE_UNAVAILABLE',
                        message:
                            'El servicio de facturación no está disponible temporalmente. Intentá de nuevo en unos momentos.'
                    }
                },
                503
            );
        }

        // ----------------------------------------------------------------
        // Step 3: Entitlement gate.
        //
        // The user must have the plan-level entitlement for this AI feature.
        // If not, return 403 ENTITLEMENT_REQUIRED with an upgrade hint —
        // mirroring the exact pattern from tourist-entitlements.ts:68.
        //
        // Skipped entirely for auth-baseline features (skipEntitlementGate):
        // those have a per-plan quota but no entitlement, so enforcing this
        // gate would reject every request (no plan grants the entitlement).
        // ----------------------------------------------------------------
        if (!options?.skipEntitlementGate) {
            const requiredEntitlement = AI_ENTITLEMENT_BY_FEATURE[feature];

            if (!hasEntitlement(c, requiredEntitlement)) {
                apiLogger.warn(
                    { userId: actor.id, feature, requiredEntitlement },
                    `createAiQuotaMiddleware: blocked — user lacks entitlement ${requiredEntitlement}`
                );

                throw new ServiceError(
                    ServiceErrorCode.ENTITLEMENT_REQUIRED,
                    'Tu plan no incluye el uso de inteligencia artificial para esta función. Actualizá tu plan para acceder.',
                    {
                        requiredEntitlement,
                        upgradeUrl: '/billing/plans'
                    }
                );
            }
        }

        // ----------------------------------------------------------------
        // Step 4: Limit value gate.
        //
        // getRemainingLimit returns the RAW plan limit:
        //   -1 → unlimited (skip count query, pass immediately)
        //    0 → feature disabled in plan (reject immediately, no DB query)
        //    N → finite monthly quota (proceed to usage count in step 5)
        // ----------------------------------------------------------------
        const limitKey = AI_LIMIT_BY_FEATURE[feature];
        const limit = getRemainingLimit(c, limitKey);

        if (limit === -1) {
            // Unlimited — no quota check needed.
            await next();
            return;
        }

        if (limit === 0) {
            // Feature explicitly disabled in the user's plan.
            apiLogger.warn(
                { userId: actor.id, feature, limitKey },
                'createAiQuotaMiddleware: blocked — feature limit is 0 (disabled in plan)'
            );

            throw new ServiceError(
                ServiceErrorCode.LIMIT_REACHED,
                'Esta función de inteligencia artificial no está disponible en tu plan actual. Actualizá tu plan para acceder.',
                {
                    limitKey,
                    currentCount: 0,
                    maxAllowed: 0
                }
            );
        }

        // ----------------------------------------------------------------
        // Step 5: Monthly usage count + quota enforcement.
        //
        // Only calls that delivered value (status 'success' or 'fallback')
        // count against quota — provider errors and prior quota rejections
        // are excluded (see getMonthlyCallCount decision note).
        //
        // When count >= limit:
        //   (a) Meter the rejected attempt FIRST (AC-6): insert a
        //       quota_exceeded row. If metering fails, log and continue to
        //       enforce — enforcement must not depend on metering success.
        //   (b) Throw 403 LIMIT_REACHED with count/limit in details.
        // ----------------------------------------------------------------
        const count = await getMonthlyCallCount({
            userId: actor.id,
            feature,
            now: new Date()
        });

        if (count >= limit) {
            // AC-6: meter the rejected attempt before throwing.
            try {
                await recordAiUsage({
                    userId: actor.id,
                    feature,
                    provider: 'none',
                    model: 'none',
                    promptTokens: 0,
                    completionTokens: 0,
                    latencyMs: 0,
                    status: 'quota_exceeded'
                });
            } catch (meteringError) {
                // Metering failure must NOT prevent enforcement.
                apiLogger.warn(
                    {
                        userId: actor.id,
                        feature,
                        error:
                            meteringError instanceof Error
                                ? meteringError.message
                                : String(meteringError)
                    },
                    'createAiQuotaMiddleware: failed to record quota_exceeded row (enforcement continues)'
                );
            }

            apiLogger.warn(
                { userId: actor.id, feature, limitKey, currentCount: count, maxAllowed: limit },
                'createAiQuotaMiddleware: monthly quota reached'
            );

            throw new ServiceError(
                ServiceErrorCode.LIMIT_REACHED,
                `Alcanzaste el límite mensual de ${limit} usos de esta función de inteligencia artificial. Actualizá tu plan para obtener más usos o esperá al reinicio del próximo mes.`,
                {
                    limitKey,
                    currentCount: count,
                    maxAllowed: limit
                }
            );
        }

        // Under quota — proceed.
        await next();
    };
}
