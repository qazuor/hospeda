/**
 * User entitlements endpoint.
 * Returns the merged entitlement set + limit map + plan context for the
 * currently authenticated user. Lets the frontend drive plan-based show/hide
 * decisions (e.g. "show the rich-description toolbar only if
 * `can_use_rich_description` is in the entitlement set") without inferring
 * from the plan slug.
 *
 * Resolves SPEC-143 Block 2 finding #28: prior to this route the only way
 * for the client to know which entitlements/limits were active was to call
 * an enforced write endpoint and observe the 403 envelope, which is
 * inadequate as a UX primitive.
 *
 * The values returned here come from the same source the enforcement
 * middlewares already read (`c.get('userEntitlements')` /
 * `c.get('userLimits')`, populated by `entitlementMiddleware`). That means
 * this endpoint is consistent with what the photo-upload route would
 * actually enforce — no risk of the client seeing a different limit than
 * the server applies.
 *
 * @route GET /api/v1/protected/users/me/entitlements
 */
import type { EntitlementKey, LimitKey } from '@repo/billing';
import type { Context } from 'hono';
import { z } from 'zod';
import { getQZPayBilling } from '../../../middlewares/billing';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

/**
 * Response schema for the merged entitlement + limit + plan view.
 *
 * Note `limits` is an object map (`{ [LimitKey]: number }`) rather than an
 * array of `{key, max}` objects so the front-end can do
 * `limits.max_photos_per_accommodation` directly. `-1` encodes "unlimited"
 * consistent with the plan catalog convention (`plans.config.ts`).
 *
 * `plan` is nullable for users without an active paid subscription. HOST
 * actors in that state still receive owner-basico defaults via the
 * `loadEntitlements` role-aware fallback shipped in PR #1244; this endpoint
 * surfaces those defaults as `plan: null` plus the populated `entitlements`/
 * `limits` so the client knows the user is in "draft host" mode without
 * needing a separate flag.
 */
const EntitlementsResponseSchema = z.object({
    entitlements: z.array(z.string()),
    limits: z.record(z.string(), z.number()),
    plan: z
        .object({
            slug: z.string(),
            name: z.string(),
            status: z.string()
        })
        .nullable(),
    asOf: z.string()
});

/**
 * GET /api/v1/protected/users/me/entitlements
 *
 * Returns the merged entitlement set + limit map + plan context for the
 * authenticated user. Reads from request context (populated by
 * `entitlementMiddleware`) so the response is by construction consistent
 * with what the enforcement middlewares would apply on the same request.
 *
 * Cached for 60s per-user via the route-factory cache TTL; the entitlement
 * cache itself has a 5min TTL inside `entitlementMiddleware`, so the
 * effective freshness window is 60s for the client. Plan/subscription
 * change paths call `clearEntitlementCache(customerId)` which invalidates
 * the server cache; the client will pick up the new state on the next call
 * after their 60s response cache expires.
 */
export const userEntitlementsRoute = createProtectedRoute({
    method: 'get',
    path: '/me/entitlements',
    summary: 'Get user entitlements + limits',
    description:
        'Returns the merged entitlement set, limit map, and active plan for the authenticated user. The same values the enforcement middlewares would apply on a write request.',
    tags: ['Users'],
    responseSchema: EntitlementsResponseSchema,
    handler: async (ctx: Context) => {
        const actor = getActorFromContext(ctx);

        // The entitlement middleware populates these on every authenticated
        // request. If the middleware short-circuited (e.g. billing disabled)
        // both will be empty rather than missing — we surface the empty
        // state rather than throw.
        const entitlementSet =
            (ctx.get('userEntitlements') as Set<EntitlementKey> | undefined) ?? new Set();
        const limitMap = (ctx.get('userLimits') as Map<LimitKey, number> | undefined) ?? new Map();

        // Resolve plan context separately. Mirrors the lookup pattern in
        // /me/subscription so the two endpoints stay in sync on plan shape.
        let plan: { slug: string; name: string; status: string } | null = null;

        const billingEnabled = ctx.get('billingEnabled');
        const billing = billingEnabled ? getQZPayBilling() : null;

        if (billing) {
            try {
                const customer = await billing.customers.getByExternalId(actor.id);
                if (customer) {
                    const subscriptions = await billing.subscriptions.getByCustomerId(customer.id);
                    const activeSub = subscriptions?.find(
                        (sub: { status: string }) =>
                            sub.status === 'active' || sub.status === 'trialing'
                    );
                    if (activeSub) {
                        const planRecord = await billing.plans.get(activeSub.planId);
                        if (planRecord) {
                            plan = {
                                slug: planRecord.name,
                                name: planRecord.name,
                                status: activeSub.status
                            };
                        }
                    }
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                apiLogger.warn(
                    { userId: actor.id, error: message },
                    'Failed to resolve plan context for /me/entitlements — returning entitlements without plan'
                );
            }
        }

        // Convert the Map / Set into JSON-friendly shapes. Sort entitlements
        // for stable response ordering (helps client diffing + test snapshots).
        const entitlements = Array.from(entitlementSet).sort();
        const limits: Record<string, number> = {};
        for (const [key, value] of limitMap) {
            limits[key] = value;
        }

        return {
            entitlements,
            limits,
            plan,
            asOf: new Date().toISOString()
        };
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
