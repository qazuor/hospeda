/**
 * PUT /api/v1/protected/gastronomies/:id/menu
 *
 * Replaces the venue's structured carta with the submitted document (HOS-895).
 *
 * ## What it answers, and in what order
 *
 * 1. **Authentication** — `createCRUDRoute` over the protected router.
 * 2. **The plan's terms** — `commerceVerticalEntitlementMiddleware('gastronomy')`
 *    loads the caller's gastronomy grants and `requireEntitlement` refuses a
 *    caller whose plan does not carry `MANAGE_GASTRONOMY_MENU`. The loader MUST
 *    stay ahead of the gate: the global `entitlementMiddleware` has already put
 *    the ACCOMMODATION set in the context, and that set never carries a commerce
 *    key (HOS-1074).
 * 3. **Ownership** — inside `replaceGastronomyMenu`, via the same
 *    `COMMERCE_EDIT_OWN` / `COMMERCE_EDIT_ALL` gate the FAQ and media writes use.
 *
 * ## The gate is on THIS route and not on the read
 *
 * `MANAGE_GASTRONOMY_MENU` gates building a carta, not seeing one. A `-basico`
 * owner opens the same editor and uses the two ungated fallbacks — the external
 * link and the uploaded photo/PDF — so `GET .../menu` must answer for them.
 * See `getMenu.ts`.
 *
 * ## Whole document, one transaction
 *
 * The body is the ENTIRE carta, and an empty `sections` array is a legitimate
 * submission meaning "delete it" — the owner who fell back to a photo needs a
 * way to say that. See `packages/service-core/src/services/gastronomy/gastronomy.menu.ts`
 * for why the carta is written whole where `gastronomy_media` is written per row.
 *
 * @module routes/gastronomy/protected/putMenu
 */
import { EntitlementKey } from '@repo/billing';
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
import { commerceVerticalEntitlementMiddleware } from '../../../middlewares/commerce-entitlement';
import { requireEntitlement } from '../../../middlewares/entitlement';
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

    // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`, the
    // same accessor the FAQ and media routes use.
    const model = (
        gastronomyService as unknown as { model: Parameters<typeof replaceGastronomyMenu>[0] }
    ).model;

    const result = await replaceGastronomyMenu(model, actor, {
        gastronomyId: params.id as string,
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
        'Replaces the listing’s sections and dishes with the submitted document. An empty sections array deletes the structured menu, leaving the uploaded photo/PDF and the external link untouched. Owner-only, and requires the manage_gastronomy_menu entitlement granted by the professional gastronomy plan and above.',
    tags: ['Gastronomy', 'Gastronomy Menu'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: GastronomyMenuReplacePayloadSchema,
    responseSchema: GastronomyMenuOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>, body: Record<string, unknown>) =>
        handlePutGastronomyMenu(ctx, params, body),
    options: {
        middlewares: [
            commerceVerticalEntitlementMiddleware('gastronomy'),
            requireEntitlement(EntitlementKey.MANAGE_GASTRONOMY_MENU)
        ]
    }
});
