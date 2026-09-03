/**
 * GET /api/v1/protected/gastronomies/:id/menu
 *
 * The owner's view of the venue's carta (HOS-895) — the structured sections and
 * dishes, plus whichever of the two fallbacks are set (the uploaded photo/PDF
 * and the external link).
 *
 * ## Why this read carries NO entitlement gate
 *
 * `MANAGE_GASTRONOMY_MENU` gates BUILDING a structured carta, not looking at
 * one. Two ordinary situations make the difference matter:
 *
 *  - A `-basico` owner opens the editor. They must see the menu section, the
 *    link field and the uploaded file — those work on every gastronomy tier —
 *    with only the structured half disabled. A gate here would answer 403 and
 *    the editor would have nothing to render.
 *  - An owner whose subscription lapsed after they typed forty dishes. Their
 *    carta is still their data; refusing to show it back to them would be the
 *    platform holding it hostage.
 *
 * The write route is where the tier is enforced.
 *
 * @module routes/gastronomy/protected/getMenu
 */
import { GastronomyMenuOutputSchema, PermissionEnum } from '@repo/schemas';
import { entityNotFoundError, GastronomyService, getGastronomyMenu } from '@repo/service-core';
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
 * contract states and `protected/getById.ts` and `brochure.ts` both follow,
 * with the same canonical message so "not yours" and "does not exist" are
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

/** Reads the carta. Exported standalone so the route test can call it directly. */
export async function handleGetGastronomyMenu(ctx: Context, params: Record<string, unknown>) {
    const gastronomyId = params.id as string;

    await requireOwnedGastronomy(ctx, gastronomyId);

    // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`, the
    // same accessor the FAQ and media routes use.
    const model = (
        gastronomyService as unknown as { model: Parameters<typeof getGastronomyMenu>[0] }
    ).model;
    const result = await getGastronomyMenu(model, { gastronomyId });

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    return result.data;
}

export const protectedGetGastronomyMenuRoute = createCRUDRoute({
    method: 'get',
    path: '/{id}/menu',
    summary: 'Read the menu of a gastronomy listing',
    description:
        "Returns the listing's structured menu (sections and dishes) together with the uploaded photo/PDF and the external menu link, if set. Owner-only. Not gated on the structured-menu entitlement: every gastronomy tier can see its own menu, and only writing the structured half is a paid capability.",
    tags: ['Gastronomy', 'Gastronomy Menu'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: GastronomyMenuOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        handleGetGastronomyMenu(ctx, params)
});
