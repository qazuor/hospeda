/**
 * PUT /api/v1/protected/gastronomies/:id/menu
 *
 * Replaces the venue's structured carta with the submitted document (HOS-895).
 *
 * ## What it answers, and in what order
 *
 * 1. **Authentication** — `createCRUDRoute` over the protected router.
 * 2. **Billing transition** — the carta write runs without the former plan
 *    entitlement or payload-specific billing gates.
 * 3. **Ownership** — inside `replaceGastronomyMenu`, via the same
 *    `GASTRONOMY_EDIT_OWN` / `GASTRONOMY_EDIT_ALL` gate the sibling writes use.
 *
 * The carta read and write have no plan entitlement gate during the billing transition.
 *
 * ## Whole document, one transaction
 *
 * The body is the ENTIRE carta, and an empty `sections` array is a legitimate
 * submission meaning "delete it". See `packages/service-core/src/services/gastronomy/gastronomy.menu.ts`
 * for why the carta is written whole where `gastronomy_media` is written per row.
 *
 * @module routes/gastronomy/protected/putMenu
 * HOS-1352: transitional until V3 (HOS-1357), see PR — the former plan gate or limit is removed.
 */

import {
    GastronomyMenuOutputSchema,
    type GastronomyMenuReplacePayload,
    GastronomyMenuReplacePayloadSchema
} from '@repo/schemas';
import { GastronomyService, replaceGastronomyMenu } from '@repo/service-core';
// Same module instance `utils/response-helpers` compares against — see
// `brochure.ts` for why the root import breaks `instanceof`.
import { ServiceError } from '@repo/service-core/types';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/** Writes the carta. Exported standalone so the route test can call it directly. */
export async function handlePutGastronomyMenu(
    ctx: Context,
    params: Record<string, unknown>,
    body: Record<string, unknown>
) {
    const actor = getActorFromContext(ctx);

    // The payload-conditional gates on MENU_ITEM_PHOTOS (HOS-1045) and
    // MULTILINGUAL_GASTRONOMY_MENU (HOS-1043) were removed with the legacy
    // billing system (HOS-1416); the menu is written unconditionally.

    // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`, the
    // same accessor the FAQ and media routes use.
    const model = (
        gastronomyService as unknown as { model: Parameters<typeof replaceGastronomyMenu>[0] }
    ).model;

    const result = await replaceGastronomyMenu(model, actor, {
        gastronomyId: params.id as string,
        // TYPE-WORKAROUND: the factory hands the handler a
        // `Record<string, unknown>`, but the body has already been validated
        // against `GastronomyMenuReplacePayloadSchema` by the route; the service
        // re-parses it anyway, so the cast asserts nothing the next line does not
        // verify.
        menu: body as unknown as GastronomyMenuReplacePayload
    });

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    return result.data;
}

export const protectedPutGastronomyMenuRoute = createCRUDRoute({
    method: 'put',
    path: '/{id}/menu',
    summary: 'Replace the structured menu of a gastronomy listing',
    description:
        'Replaces the listing’s sections and dishes with the submitted document. An empty sections array deletes the structured menu, leaving the uploaded photo/PDF and the external link untouched. Owner-only, and requires the manage_gastronomy_menu entitlement granted by the professional gastronomy plan and above; a document carrying a per-dish photo additionally requires menu_item_photos (premium), and a document carrying a nameI18n/descriptionI18n translation additionally requires multilingual_gastronomy_menu (premium).',
    tags: ['Gastronomy', 'Gastronomy Menu'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: GastronomyMenuReplacePayloadSchema,
    responseSchema: GastronomyMenuOutputSchema,
    // HOS-1352: transitional until V3 (HOS-1357), see PR — removed MENU_ITEM_PHOTOS entitlement gate.
    handler: async (ctx: Context, params: Record<string, unknown>, body: Record<string, unknown>) =>
        handlePutGastronomyMenu(ctx, params, body),
    options: {}
});
