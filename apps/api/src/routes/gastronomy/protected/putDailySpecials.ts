/**
 * PUT /api/v1/protected/gastronomies/:id/daily-specials
 *
 * Replaces the venue's menú del día with the submitted document (HOS-1041).
 *
 * ## What it answers, and in what order
 *
 * 1. **Authentication** — `createCRUDRoute` over the protected router.
 * 2. **The plan's terms** — `commerceVerticalEntitlementMiddleware('gastronomy')`
 *    loads the caller's gastronomy grants and `requireEntitlement` refuses a
 *    caller whose plan does not carry `MANAGE_GASTRONOMY_DAILY_SPECIAL`. The
 *    loader MUST stay ahead of the gate: the global `entitlementMiddleware` has
 *    already put the ACCOMMODATION set in the context, and that set never
 *    carries a commerce key (HOS-1074).
 * 3. **Ownership** — inside `replaceGastronomyDailySpecials`, via the same
 *    `COMMERCE_EDIT_OWN` / `COMMERCE_EDIT_ALL` gate the carta, FAQ and media
 *    writes use.
 *
 * ## The gate is on THIS route and not on the read
 *
 * `MANAGE_GASTRONOMY_DAILY_SPECIAL` gates publishing a menú del día, not seeing
 * one. See `getDailySpecials.ts` for the two ordinary situations that make the
 * difference matter.
 *
 * ## Whole document, one transaction
 *
 * The body is the ENTIRE menú del día, and an empty `specials` array is a
 * legitimate submission meaning "take it down" — the manual escape hatch beside
 * the automatic expiry, for the venue that sold out at 13:00. See
 * `packages/service-core/src/services/gastronomy/gastronomy.daily-specials.ts`.
 *
 * @module routes/gastronomy/protected/putDailySpecials
 */
import { EntitlementKey } from '@repo/billing';
import {
    GastronomyDailySpecialsOutputSchema,
    type GastronomyDailySpecialsReplacePayload,
    GastronomyDailySpecialsReplacePayloadSchema
} from '@repo/schemas';
import { GastronomyService, replaceGastronomyDailySpecials } from '@repo/service-core';
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

/** Writes the specials. Exported standalone so the route test can call it directly. */
export async function handlePutGastronomyDailySpecials(
    ctx: Context,
    params: Record<string, unknown>,
    body: Record<string, unknown>
) {
    const actor = getActorFromContext(ctx);

    // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`, the
    // same accessor the menu, FAQ and media routes use.
    const model = (
        gastronomyService as unknown as {
            model: Parameters<typeof replaceGastronomyDailySpecials>[0];
        }
    ).model;

    const result = await replaceGastronomyDailySpecials(model, actor, {
        gastronomyId: params.id as string,
        // TYPE-WORKAROUND: the factory hands the handler a
        // `Record<string, unknown>`, but the body has already been validated
        // against `GastronomyDailySpecialsReplacePayloadSchema` by the route;
        // the service re-parses it anyway, so the cast asserts nothing the next
        // line does not verify.
        specials: body as unknown as GastronomyDailySpecialsReplacePayload
    });

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    return result.data;
}

export const protectedPutGastronomyDailySpecialsRoute = createCRUDRoute({
    method: 'put',
    path: '/{id}/daily-specials',
    summary: 'Replace the menú del día of a gastronomy listing',
    description:
        'Replaces the listing’s daily specials with the submitted document. Each special carries its own inclusive validity window and stops being shown publicly once it passes — no job runs and nothing has to be taken down by hand. An empty specials array removes them immediately. Owner-only, and requires the manage_gastronomy_daily_special entitlement granted by the professional gastronomy plan and above.',
    tags: ['Gastronomy', 'Gastronomy Daily Specials'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: GastronomyDailySpecialsReplacePayloadSchema,
    responseSchema: GastronomyDailySpecialsOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>, body: Record<string, unknown>) =>
        handlePutGastronomyDailySpecials(ctx, params, body),
    options: {
        middlewares: [
            commerceVerticalEntitlementMiddleware('gastronomy'),
            requireEntitlement(EntitlementKey.MANAGE_GASTRONOMY_DAILY_SPECIAL)
        ]
    }
});
