/**
 * Protected publish-precheck endpoint, one route for all three verticals
 * (HOS-1156 D-7, AC-9).
 *
 * The read-only endpoint each `/publicar/*` page calls BEFORE rendering its
 * create form, so it can decide which of the six matrix outcomes to show:
 * create directly, resume a DRAFT, pick among several, or send the owner to
 * upgrade because their plan has no room left.
 *
 * ## One route, not three
 *
 * The decision matrix is identical across verticals; only the limit key and the
 * draft query differ, and both are resolved from the vertical
 * (`LIMIT_KEY_BY_PUBLISH_VERTICAL`, `publish-listing-reads`). Three routes would
 * have been three copies of one matrix, which is three places for it to drift.
 *
 * ## Access
 *
 * Any authenticated user, no permission required — the same posture as the
 * accommodation precheck it generalises, and for the same reason: a tourist who
 * has never published anything still needs to be told they may `create_direct`
 * before they are shown the form. Read-only; mutates nothing.
 *
 * ## The draft id is a plain uuid (T-008)
 *
 * The accommodation-only ancestor typed it `AccommodationIdSchema`, which cannot
 * describe a gastronomy or experience listing. Every other field is unchanged, so
 * the accommodation response shape is byte-identical to what
 * `/host-onboarding/precheck` returns today.
 *
 * @module routes/publish/protected/precheck
 */

import type { Context } from 'hono';
import { z } from 'zod';
import { resolvePublishPrecheck } from '../../../services/publish-precheck.service';
import type { AppBindings } from '../../../types';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

/**
 * The three verticals, as a closed enum.
 *
 * Declared here as the ROUTE's contract so an unknown value is rejected by the
 * factory's own param validation with a 400, before the handler runs — rather
 * than reaching `parsePublishVertical` and throwing a 500. The union is the same
 * one `PublishVertical` declares; this is its HTTP boundary.
 */
const PublishVerticalParamSchema = z.enum(['accommodation', 'gastronomy', 'experience']);

/** One DRAFT listing, as the panel's picker renders it. */
const PublishPrecheckDraftSchema = z.object({
    id: z.string().uuid(),
    slug: z.string(),
    name: z.string()
});

const PublishPrecheckResponseSchema = z.object({
    currentCount: z.number().int().nonnegative(),
    maxAllowed: z.number().int(),
    hasQuota: z.boolean(),
    draftCount: z.number().int().nonnegative(),
    drafts: z.array(PublishPrecheckDraftSchema),
    decision: z.enum([
        'create_direct',
        'upgrade_only',
        'resume_or_create',
        'resume_delete_or_upgrade',
        'pick_draft_or_create',
        'pick_draft_delete_or_upgrade'
    ])
});

/**
 * GET /api/v1/protected/publish/precheck/{vertical}
 */
export const protectedPublishPrecheckRoute = createProtectedRoute({
    method: 'get',
    path: '/precheck/{vertical}',
    summary: 'Precheck publishing in one vertical',
    description:
        "Returns the listing count, the plan quota, the caller's DRAFT listings and the derived publish decision for one vertical, so the /publicar/* page can pick the right panel before rendering its create form. Read-only; no special permissions required.",
    tags: ['Publish'],
    requestParams: { vertical: PublishVerticalParamSchema },
    responseSchema: PublishPrecheckResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        // The factory hands params down as `Record<string, unknown>`, so the
        // narrowing the `requestParams` schema already performed is not carried
        // in the type. Re-parsing here is not ceremony: it is what turns an
        // `unknown` into the closed union the cap resolver indexes its map with,
        // and an unindexed map answers `undefined` — read as "no cap" by every
        // layer beneath.
        const vertical = PublishVerticalParamSchema.parse(params.vertical);

        return resolvePublishPrecheck({
            ctx: ctx as Context<AppBindings>,
            actor,
            vertical
        });
    }
});
