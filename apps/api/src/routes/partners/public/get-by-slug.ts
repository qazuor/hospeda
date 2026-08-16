/**
 * Public partner detail endpoint (HOS-294 D-5).
 *
 * Serves the gold partner's own page at `/partners/<slug>/`. Keyed by SLUG and
 * never by UUID: a UUID is not shareable from memory, tells a search engine
 * nothing, and leaks an internal identifier.
 */

import { PartnerPublicSchema, ServiceErrorCode } from '@repo/schemas';
import { PartnerService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor.js';
import { apiLogger } from '../../../utils/logger.js';
import { createPublicRoute } from '../../../utils/route-factory.js';
import { z } from '../../../utils/zod';

const partnerService = new PartnerService({ logger: apiLogger });

/**
 * Resolves a partner for a public detail request, or raises the right refusal.
 *
 * The three service outcomes become three DIFFERENT answers, and the split
 * between the last two is the point:
 *
 * - `gone` -> HTTP 410. The partner was deliberately REVOKED. 410 is the one
 *   irreversible answer — it tells a crawler to drop the URL for good — so it
 *   is reserved for the one irreversible state (HOS-562).
 * - `notFound` -> HTTP 404. Everything else: not gold, no row, never published,
 *   or a lapsed subscription. All of those are reversible, so none of them may
 *   earn a permanent deindex. A partner who stops paying and later regularises
 *   must come back with their ranking intact.
 *
 * Answering 404 for both would still render correctly in a browser and would
 * quietly throw away the deindex signal — which is the only reason the service
 * bothers to distinguish them.
 *
 * A service ERROR is re-raised as itself, never folded into a 404: an outage
 * that renders as "this partner does not exist" is an outage nobody notices.
 *
 * Exported so the mapping can be asserted without standing up the middleware
 * chain, following the precedent in `send-link.content-gate.test.ts`.
 *
 * @param ctx - Hono context, used only to resolve the (anonymous) actor.
 * @param params - Validated route params carrying `slug`.
 * @returns The public partner payload.
 * @throws {ServiceError} `GONE` or `NOT_FOUND`, per the outcome.
 */
export const getPublicPartnerBySlugHandler = async (
    ctx: Context,
    params: Record<string, unknown>
) => {
    const actor = getActorFromContext(ctx);
    const slug = params.slug as string;

    const result = await partnerService.getPublicBySlug(actor, { slug });

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    if (result.data?.outcome === 'gone') {
        // HOS-562: says "revoked", not "no longer published". The old wording
        // inherited the same assumption the old gate did — it was logged
        // verbatim against a partner that had NEVER been published, which is
        // how the smoke found the bug. `gone` now means exactly one thing.
        throw new ServiceError(
            ServiceErrorCode.GONE,
            `Partner with slug "${slug}" has been revoked`
        );
    }

    if (result.data?.outcome !== 'found') {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, `Partner with slug "${slug}" not found`);
    }

    return result.data.partner;
};

/**
 * GET /api/v1/public/partners/{slug}
 *
 * Returns the public payload for one gold partner. 410 only when the partner
 * was deliberately revoked; 404 for every other reason it is not visible.
 */
export const publicGetPartnerBySlugRoute = createPublicRoute({
    method: 'get',
    path: '/{slug}',
    summary: 'Get a partner by slug',
    description:
        'Returns the public detail payload for a gold-tier partner. ' +
        'Responds 410 only when the partner was deliberately revoked — the one ' +
        'permanent state — and 404 for every other reason it is not visible: a ' +
        'silver partner, no such row, a gold partner never published, or one ' +
        'whose subscription lapsed (a temporary outage, which must not be ' +
        'deindexed permanently).',
    tags: ['Partners'],
    requestParams: {
        slug: z
            .string()
            .min(1)
            .max(255)
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
                message: 'slug must be lowercase alphanumeric with hyphens'
            })
            .openapi({ description: 'Partner URL slug' })
    },
    responseSchema: PartnerPublicSchema,
    handler: getPublicPartnerBySlugHandler,
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
