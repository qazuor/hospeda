/**
 * POST /api/v1/protected/price-alerts
 *
 * Subscribes the authenticated actor to price-drop notifications for an
 * accommodation. Gated by the `PRICE_ALERTS` entitlement plus the
 * `MAX_ACTIVE_ALERTS` per-plan limit (SPEC-286 T-005).
 *
 * @route POST /api/v1/protected/price-alerts
 * @module routes/price-alert/protected/create
 */
import { EntitlementKey } from '@repo/billing';
import { CreatePriceAlertInputSchema, PriceAlertResponseSchema } from '@repo/schemas';
import { AccommodationService, AlertSubscriptionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { hasEntitlement } from '../../../middlewares/entitlement';
import { gateAlerts } from '../../../middlewares/tourist-entitlements';
import type { AppMiddleware } from '../../../types';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const alertSubscriptionService = new AlertSubscriptionService({ logger: apiLogger });
const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Pre-populates `currentActiveAlertsCount` on the Hono context so
 * {@link gateAlerts} can enforce the `MAX_ACTIVE_ALERTS` limit BEFORE the
 * create handler runs. Runs after `protectedAuthMiddleware` (wired by
 * `createProtectedRoute`), so the actor is always resolvable here.
 *
 * Mirrors the `setCompareCount` pattern in
 * `accommodation/protected/compare.ts`, except the count comes from a
 * service call (the actor's current active-subscription count) rather than
 * from the request body.
 *
 * Skips the `countActive` DB query entirely when the actor lacks the
 * `PRICE_ALERTS` entitlement: those requests are about to be rejected by
 * {@link gateAlerts} anyway, so populating a count for them just pays for a
 * query whose result is never used. Entitled actors (and staff, who always
 * carry the unlimited bypass set — INV-6) still get the count populated as
 * before, since `gateAlerts` needs it for the limit check.
 */
const populateActiveAlertsCount: AppMiddleware = async (c, next) => {
    if (!hasEntitlement(c, EntitlementKey.PRICE_ALERTS)) {
        // No entitlement — `gateAlerts` will throw ENTITLEMENT_REQUIRED
        // before ever reading `currentActiveAlertsCount`. Leave it unset.
        await next();
        return;
    }

    const actor = getActorFromContext(c);
    const result = await alertSubscriptionService.countActive(actor);
    const count = result.error ? 0 : (result.data?.count ?? 0);
    c.set('currentActiveAlertsCount' as never, count as never);
    await next();
};

/**
 * POST /api/v1/protected/price-alerts
 * Subscribe to price-drop alerts for an accommodation — Protected endpoint.
 *
 * Gate order (all run BEFORE the handler):
 * 1. `protectedAuthMiddleware` — enforces session (injected by `createProtectedRoute`)
 * 2. `entitlementMiddleware` — loads the actor's entitlement + limit set into context
 *    (mounted globally in `create-app.ts`; NOT repeated here)
 * 3. `populateActiveAlertsCount` — reads the actor's active-alert count via the service,
 *    but ONLY when the actor already has `PRICE_ALERTS` — otherwise it's a no-op, since
 *    step 4 is about to reject the request regardless of the count
 * 4. `gateAlerts` — throws ENTITLEMENT_REQUIRED or LIMIT_REACHED when appropriate
 *
 * The response denormalizes `accommodationName` from a fresh accommodation
 * read — `AlertSubscriptionService.create()` does not re-fetch relations on
 * write (no `getDefaultWriteResponseRelations()` override), so the created
 * entity comes back flat with no `.accommodation` object attached.
 *
 * Returns 201 Created (default POST status).
 */
export const createPriceAlertRoute = createProtectedRoute({
    method: 'post',
    path: '/',
    summary: 'Subscribe to price-drop alerts',
    description:
        'Creates a price-alert subscription for the authenticated actor on the given accommodation. Requires the PRICE_ALERTS entitlement (Plus / VIP plans) and enforces the MAX_ACTIVE_ALERTS per-plan limit.',
    tags: ['Price Alerts'],
    requestBody: CreatePriceAlertInputSchema,
    responseSchema: PriceAlertResponseSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const input = body as { accommodationId: string; targetPercentDrop?: number };

        const result = await alertSubscriptionService.create(actor, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        // biome-ignore lint/style/noNonNullAssertion: result.data is guaranteed when result.error is absent
        const alert = result.data!;

        const accommodationResult = await accommodationService.getById(
            actor,
            alert.accommodationId
        );
        const accommodationName = accommodationResult.error
            ? ''
            : (accommodationResult.data?.name ?? '');

        return { ...alert, accommodationName };
    },
    options: {
        middlewares: [populateActiveAlertsCount, gateAlerts()]
    }
});
