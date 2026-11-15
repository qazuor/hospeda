/**
 * Public partner detail endpoint, gated by the owner's public-page key.
 */

import { PartnerPublicSchema, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { getPublicPartnerPage } from '../../../services/partner-presence/partner-presence-read.service.js';
import { createPublicRoute } from '../../../utils/route-factory.js';
import { z } from '../../../utils/zod';

/**
 * Resolve a public partner page or return the indistinguishable 404 refusal.
 * AC:V7:13; V7 §1.6 (V/18 §1.6).
 * @param params - Validated route params carrying `slug`.
 * @returns The public partner payload.
 * @throws {ServiceError} `NOT_FOUND` when no public presence is available.
 */
export const getPublicPartnerBySlugHandler = async (
    _ctx: unknown,
    params: Record<string, unknown>
) => {
    const slug = params.slug as string;
    const result = await getPublicPartnerPage({ slug });
    if (!result) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, `Partner with slug "${slug}" not found`);
    }
    return result.partner;
};

/**
 * GET /api/v1/public/partners/{slug}
 *
 * The page is visible only while its owner has the public-page key and presence is unmoderated.
 * AC:V7:13; V7 §1.6 (V/18 §1.6).
 */
export const publicGetPartnerBySlugRoute = createPublicRoute({
    method: 'get',
    path: '/{slug}',
    summary: 'Get a partner by slug',
    description:
        'Returns a partner page when its owner has the public-page key and presence is unmoderated; otherwise returns 404.',
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
