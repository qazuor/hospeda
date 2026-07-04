/**
 * @file public-data.ts
 *
 * GET /api/v1/ai/social/public-data
 *
 * Read-only public-data-pull endpoint consumed by the Custom GPT to enrich a
 * social draft — it returns a tightly-scoped set of public accommodations and
 * destinations (title, slug, summary, image) the GPT can reference or link
 * instead of hallucinating one.
 *
 * Authenticated via the inbound `x-hospeda-ai-key` API key ONLY — no session,
 * no operator_pin (same as GET /catalog).
 *
 * Unlike catalog.ts (which queries DB models directly to bypass the
 * permission-gated social services), this endpoint CAN use its service:
 * `SocialPublicDataService` is deliberately permission-free (it only reads
 * PUBLIC/ACTIVE entities), so the synthetic empty-permission `gpt-action`
 * actor can call it without a FORBIDDEN.
 *
 * @module routes/ai/social/public-data
 * @see HOS-66 T-023 (G-10)
 */

import { SocialPublicDataResponseDataSchema } from '@repo/schemas';
import { SocialPublicDataService } from '@repo/service-core';
import { z } from 'zod';
import { getDecryptedSocialCredential } from '../../../services/social-credential-vault.service.js';
import { createApiKeyRoute } from '../../../utils/route-factory-tiered';

/**
 * Builds the standard error envelope returned to the Custom GPT on failure.
 */
function buildErrorJson(
    code: string,
    message: string
): {
    success: false;
    error: { code: string; message: string };
} {
    return { success: false, error: { code, message } };
}

/**
 * GET /api/v1/ai/social/public-data
 *
 * Returns `{ items }` — public accommodations + destinations shaped for draft
 * enrichment, most recent first. Accepts an optional free-text `query` param to
 * narrow results by title/name.
 */
export const socialPublicDataRoute = createApiKeyRoute({
    method: 'get',
    path: '/',
    summary: 'GPT social public-data pull',
    description:
        'Returns a tightly-scoped set of PUBLIC accommodations and destinations (id, title, slug, summary, imageUrl) the Custom GPT can pull to enrich a social draft — e.g. to link a specific accommodation or reference a destination by name instead of inventing one. ' +
        'Optional `query` narrows results by title/name. Scope is intentionally limited to accommodations + destinations; it is NOT a general public API.',
    tags: ['AI - Social'],
    apiKeyConfig: {
        headerName: 'x-hospeda-ai-key',
        getExpectedKey: async () =>
            (await getDecryptedSocialCredential({ key: 'ai_social_key' })).data?.plaintext,
        actor: { id: 'gpt-action', name: 'Custom GPT Social Action' }
    },
    requestQuery: { query: z.string().optional() },
    responseSchema: SocialPublicDataResponseDataSchema,
    handler: async (ctx, _params, _body, query) => {
        const rawQuery = typeof query?.query === 'string' ? query.query : undefined;

        const service = new SocialPublicDataService();
        const result = await service.getPublicData({ query: rawQuery });

        if (result.error) {
            return ctx.json(buildErrorJson(result.error.code, result.error.message), 500) as never;
        }

        return result.data;
    }
});
