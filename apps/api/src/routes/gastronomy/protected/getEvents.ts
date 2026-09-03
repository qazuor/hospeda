/**
 * GET /api/v1/protected/gastronomies/:id/events
 *
 * The owner's view of the venue's own agenda (HOS-1042) — every entry, in
 * order, `isActive: false` ones included.
 *
 * ## Why this read carries NO entitlement gate
 *
 * Exactly the position `getMenu.ts` takes, and for one of its two reasons
 * rather than both.
 *
 * The reason that does NOT carry over: there is no ungated fallback here. A
 * `-basico` owner has no external-link or uploaded-photo half of an agenda to
 * keep working, so this read answers them an empty list and their editor shows
 * the upsell.
 *
 * The reason that does: an owner whose subscription lapsed after typing a
 * season of events still owns those rows. Refusing to show them back would be
 * the platform holding their data hostage, and it would also mean that
 * resubscribing looked like starting over. So the read stays open, the write is
 * where the tier is enforced, and the public page is where the display is
 * withheld.
 *
 * @module routes/gastronomy/protected/getEvents
 */
import { GastronomyEventsOutputSchema, PermissionEnum } from '@repo/schemas';
import { entityNotFoundError, GastronomyService, getGastronomyEvents } from '@repo/service-core';
// Same module instance `utils/response-helpers` compares against: importing
// `ServiceError` from the package ROOT yields a DIFFERENT class under the test
// resolver, and `instanceof` then fails — a NOT_FOUND answered as a 500.
import { ServiceError } from '@repo/service-core/types';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * Refuses any listing that is not the caller's, as a 404.
 *
 * A 403 would confirm the id exists — the anti-enumeration rule the error
 * contract states and `getMenu.ts` / `protected/getById.ts` both follow, with
 * the same canonical message so "not yours" and "does not exist" are
 * indistinguishable.
 *
 * @param ctx - The Hono request context.
 * @param gastronomyId - The listing being read.
 * @returns Nothing; throws when the caller may not read this listing.
 */
async function requireOwnedGastronomy(ctx: Context, gastronomyId: string): Promise<void> {
    const actor = getActorFromContext(ctx);
    const result = await gastronomyService.getById(actor, gastronomyId);

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    const hasViewAll = actor.permissions?.includes(PermissionEnum.COMMERCE_VIEW_ALL);
    if (!result.data || (!hasViewAll && result.data.ownerId !== actor.id)) {
        throw entityNotFoundError({ entityName: GastronomyService.ENTITY_NAME });
    }
}

/** Reads the agenda. Exported standalone so the route test can call it directly. */
export async function handleGetGastronomyEvents(ctx: Context, params: Record<string, unknown>) {
    const gastronomyId = params.id as string;

    await requireOwnedGastronomy(ctx, gastronomyId);

    // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`, the
    // same accessor the FAQ, media and menu routes use.
    const model = (
        gastronomyService as unknown as { model: Parameters<typeof getGastronomyEvents>[0] }
    ).model;
    const result = await getGastronomyEvents(model, { gastronomyId });

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    return result.data;
}

export const protectedGetGastronomyEventsRoute = createCRUDRoute({
    method: 'get',
    path: '/{id}/events',
    summary: 'Read the venue events agenda of a gastronomy listing',
    description:
        "Returns the listing's own events — live music night, happy hour, dinner show — in display order, including entries the owner has switched off. Owner-only. Not gated on the venue-events entitlement: an owner whose plan no longer grants it still owns the rows, and only writing is a paid capability.",
    tags: ['Gastronomy', 'Gastronomy Events'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: GastronomyEventsOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        handleGetGastronomyEvents(ctx, params)
});
