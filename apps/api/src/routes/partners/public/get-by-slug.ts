/**
 * Public partner detail endpoint (HOS-294 D-5).
 *
 * Keeps the public detail page dark until V7 restores it on the public key.
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
 * The public page is unavailable until V7 restores it on the public key, so
 * every successful lookup outcome is translated to HTTP 404.
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

    throw new ServiceError(ServiceErrorCode.NOT_FOUND, `Partner with slug "${slug}" not found`);
};

/**
 * GET /api/v1/public/partners/{slug}
 *
 * The public page remains unavailable until V7 restores it on the public key.
 */
export const publicGetPartnerBySlugRoute = createPublicRoute({
    method: 'get',
    path: '/{slug}',
    summary: 'Get a partner by slug',
    description:
        'The public detail page remains unavailable until V7 restores it on the public key. ' +
        'Responds 404 until V7 restores the public page on the partner key.',
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
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
