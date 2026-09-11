/**
 * GET /api/v1/protected/gastronomies/:id/daily-specials
 *
 * The owner's view of the venue's menú del día (HOS-1041).
 *
 * ## Why this read carries NO entitlement gate
 *
 * `MANAGE_GASTRONOMY_DAILY_SPECIAL` gates PUBLISHING a menú del día, not
 * looking at one — the same split `getMenu.ts` makes, for the same two ordinary
 * situations: a `-basico` owner opening the editor must see the panel (with the
 * save refused, not the page blank), and an owner whose subscription lapsed
 * after scheduling next week's specials is still looking at their own data.
 * Refusing to show it back to them would be the platform holding it hostage.
 *
 * The write route is where the tier is enforced.
 *
 * ## Why this read is NOT filtered by the validity window
 *
 * It deliberately passes no `validOn`, so it returns every special the listing
 * holds — including the ones scheduled for next Friday and the ones that
 * elapsed last week. The public read filters; the editor must not. An owner who
 * scheduled a special for tomorrow and reloaded the page would otherwise find
 * an empty form and no explanation, and an owner who wanted to reuse last
 * week's would have nothing to edit.
 *
 * @module routes/gastronomy/protected/getDailySpecials
 */
import { GastronomyDailySpecialsOutputSchema, PermissionEnum } from '@repo/schemas';
import {
    entityNotFoundError,
    GastronomyService,
    getGastronomyDailySpecials
} from '@repo/service-core';
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
 * contract states, with the same canonical message `getMenu.ts` uses so "not
 * yours" and "does not exist" are indistinguishable.
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

/** Reads the specials. Exported standalone so the route test can call it directly. */
export async function handleGetGastronomyDailySpecials(
    ctx: Context,
    params: Record<string, unknown>
) {
    const gastronomyId = params.id as string;

    await requireOwnedGastronomy(ctx, gastronomyId);

    // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`, the
    // same accessor the menu, FAQ and media routes use.
    const model = (
        gastronomyService as unknown as {
            model: Parameters<typeof getGastronomyDailySpecials>[0];
        }
    ).model;
    const result = await getGastronomyDailySpecials(model, { gastronomyId });

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    return result.data;
}

export const protectedGetGastronomyDailySpecialsRoute = createCRUDRoute({
    method: 'get',
    path: '/{id}/daily-specials',
    summary: 'Read the menú del día of a gastronomy listing',
    description:
        'Returns every daily special the listing holds — including ones scheduled for the future and ones whose validity window has already passed, which the owner needs in order to edit them. Owner-only. Not gated on the menú-del-día entitlement: every gastronomy tier can see its own specials, and only publishing them is a paid capability.',
    tags: ['Gastronomy', 'Gastronomy Daily Specials'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: GastronomyDailySpecialsOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        handleGetGastronomyDailySpecials(ctx, params)
});
