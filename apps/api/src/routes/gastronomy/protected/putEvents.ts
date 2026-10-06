/**
 * PUT /api/v1/protected/gastronomies/:id/events
 * HOS-1352: transitional until V3 (HOS-1357), see PR — the former plan gate or limit is removed.
 */

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
    // HOS-1352: transitional until V3 (HOS-1357), see PR — removed MANAGE_GASTRONOMY_EVENTS entitlement gate.
    handler: async (ctx: Context, params: Record<string, unknown>, body: Record<string, unknown>) =>
        handlePutGastronomyEvents(ctx, params, body),
    options: {}
});
