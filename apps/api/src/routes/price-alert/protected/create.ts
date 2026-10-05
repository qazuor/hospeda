/**
 * POST /api/v1/protected/price-alerts
 * Subscribe to price-drop alerts for an accommodation — Protected endpoint.
 *
 * The PRICE_ALERTS entitlement gate and MAX_ACTIVE_ALERTS limit (gateAlerts +
 * populateActiveAlertsCount) were removed with the legacy billing system
 * (HOS-1416).
 *
 * The response denormalizes `accommodationName` from a fresh accommodation
 * read — `AlertSubscriptionService.create()` does not re-fetch relations on
 * write (no `getDefaultWriteResponseRelations()` override), so the created
 * entity comes back flat with no `.accommodation` object attached.
 *
 * Returns 201 Created (default POST status).
 */

import { CreatePriceAlertInputSchema, PriceAlertResponseSchema } from '@repo/schemas';
import { AccommodationService, AlertSubscriptionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const alertSubscriptionService = new AlertSubscriptionService({ logger: apiLogger });
const accommodationService = new AccommodationService({ logger: apiLogger });

export const createPriceAlertRoute = createProtectedRoute({
    method: 'post',
    path: '/',
    summary: 'Subscribe to price-drop alerts',
    description:
        'Creates a price-alert subscription for the authenticated actor on the given accommodation.',
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
    }
});
