/**
 * PUT /api/v1/protected/gastronomies/:id/events
 *
 * Replaces the venue's own agenda with the submitted document (HOS-1042).
 *
 * ## What it answers, and in what order
 *
 * 1. **Authentication** — `createCRUDRoute` over the protected router.
 * 2. **The plan's terms** — `commerceVerticalEntitlementMiddleware('gastronomy')`
 *    loads the caller's gastronomy grants and `requireEntitlement` refuses a
 *    caller whose plan does not carry `MANAGE_GASTRONOMY_EVENTS`. The loader
 *    MUST stay ahead of the gate: the global `entitlementMiddleware` has already
 *    put the ACCOMMODATION set in the context, and that set never carries a
 *    commerce key (HOS-1074). Mounted the other way round, or omitted, the gate
 *    refuses everyone.
 * 3. **Ownership** — inside `replaceGastronomyEvents`, via the same
 *    `COMMERCE_EDIT_OWN` / `COMMERCE_EDIT_ALL` gate the FAQ, media and menu
 *    writes use.
 *
 * ## The gate is on THIS route and not on the read
 *
 * `MANAGE_GASTRONOMY_EVENTS` gates keeping an agenda, not looking at one an
 * owner already typed. See `getEvents.ts` for why that read stays open even
 * though — unlike the carta — there is no free fallback shape here.
 *
 * ## Whole document, one transaction
 *
 * The body is the ENTIRE agenda, and an empty `events` array is a legitimate
 * submission meaning "take it down" — a venue that stopped doing live music
 * needs a way to say so. See
 * `packages/service-core/src/services/gastronomy/gastronomy.events.ts` for why
 * the agenda is written whole where `gastronomy_media` is written per row.
 *
 * @module routes/gastronomy/protected/putEvents
 */
import { EntitlementKey } from '@repo/billing';
import {
    GastronomyEventsOutputSchema,
    type GastronomyEventsReplacePayload,
    GastronomyEventsReplacePayloadSchema
} from '@repo/schemas';
import { GastronomyService, replaceGastronomyEvents } from '@repo/service-core';
// Same module instance `utils/response-helpers` compares against — see
// `brochure.ts` for why the root import breaks `instanceof`.
import { ServiceError } from '@repo/service-core/types';
import type { Context } from 'hono';
import { z } from 'zod';
import { commerceVerticalEntitlementMiddleware } from '../../../middlewares/commerce-entitlement';
import { requireEntitlement } from '../../../middlewares/entitlement';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/** Writes the agenda. Exported standalone so the route test can call it directly. */
export async function handlePutGastronomyEvents(
    ctx: Context,
    params: Record<string, unknown>,
    body: Record<string, unknown>
) {
    const actor = getActorFromContext(ctx);

    // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`, the
    // same accessor the FAQ, media and menu routes use.
    const model = (
        gastronomyService as unknown as { model: Parameters<typeof replaceGastronomyEvents>[0] }
    ).model;

    const result = await replaceGastronomyEvents(model, actor, {
        gastronomyId: params.id as string,
        // TYPE-WORKAROUND: the factory hands the handler a
        // `Record<string, unknown>`, but the body has already been validated
        // against `GastronomyEventsReplacePayloadSchema` by the route; the
        // service re-parses it anyway, so the cast asserts nothing the next line
        // does not verify.
        agenda: body as unknown as GastronomyEventsReplacePayload
    });

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    return result.data;
}

export const protectedPutGastronomyEventsRoute = createCRUDRoute({
    method: 'put',
    path: '/{id}/events',
    summary: 'Replace the venue events agenda of a gastronomy listing',
    description:
        'Replaces the listing’s own events with the submitted document. Each entry is either dated (recurrence "once" with a date) or weekly (recurrence "weekly" with a weekday 0-6, Sunday-based); the two are mutually exclusive and the payload is rejected if an entry declares neither or both. An empty events array takes the agenda down. Owner-only, and requires the manage_gastronomy_events entitlement granted by the professional gastronomy plan and above.',
    tags: ['Gastronomy', 'Gastronomy Events'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: GastronomyEventsReplacePayloadSchema,
    responseSchema: GastronomyEventsOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>, body: Record<string, unknown>) =>
        handlePutGastronomyEvents(ctx, params, body),
    options: {
        middlewares: [
            commerceVerticalEntitlementMiddleware('gastronomy'),
            requireEntitlement(EntitlementKey.MANAGE_GASTRONOMY_EVENTS)
        ]
    }
});
