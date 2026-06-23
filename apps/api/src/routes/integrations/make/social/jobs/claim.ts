/**
 * @file claim.ts
 *
 * POST /api/v1/integrations/make/social/jobs/{targetId}/claim
 *
 * Inbound Make.com claim callback: Make calls this endpoint when it picks up
 * a dispatched publish job, transitioning the target to PUBLISHING and recording
 * the Make scenario run ID for correlation.
 *
 * Authentication: static inbound API key in `x-hospeda-make-key` header.
 * No session or Better Auth required — machine-to-machine.
 *
 * @module routes/integrations/make/social/jobs/claim
 * @see SPEC-254 T-048, US-12
 */

import { IdSchema, MakeClaimCallbackResponseSchema, MakeClaimCallbackSchema } from '@repo/schemas';
import { SocialPublishDispatchService } from '@repo/service-core';
import { env } from '../../../../../utils/env';
import { apiLogger } from '../../../../../utils/logger';
import { createApiKeyRoute } from '../../../../../utils/route-factory-tiered';

const dispatchService = new SocialPublishDispatchService({ logger: apiLogger });

/**
 * POST /api/v1/integrations/make/social/jobs/{targetId}/claim
 *
 * Make.com calls this endpoint to claim a dispatched publish job.
 * Transitions the target to PUBLISHING and records the makeRunId.
 *
 * Errors:
 *  - 401 — missing or invalid `x-hospeda-make-key` (middleware)
 *  - 404 — target not found (NOT_FOUND)
 *  - 409 — target already published (ALREADY_EXISTS + reason ALREADY_PUBLISHED)
 */
export const makeClaimCallbackRoute = createApiKeyRoute({
    method: 'post',
    path: '/{targetId}/claim',
    summary: 'Make.com claim callback',
    description:
        'Make.com calls this endpoint when it picks up a dispatched publish job. Transitions the social_post_target to PUBLISHING and records the Make scenario run ID.',
    tags: ['Integrations - Make'],
    apiKeyConfig: {
        headerName: 'x-hospeda-make-key',
        getExpectedKey: () => env.HOSPEDA_MAKE_INBOUND_KEY,
        actor: { id: 'make-callback', name: 'Make.com Callback' }
    },
    requestParams: { targetId: IdSchema },
    requestBody: MakeClaimCallbackSchema,
    responseSchema: MakeClaimCallbackResponseSchema,
    successStatusCode: 200,
    handler: async (
        _ctx: unknown,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const targetId = params.targetId as string;
        const makeRunId = body.makeRunId as string;

        return await dispatchService.handleMakeCallbackClaim({ targetId, makeRunId });
    }
});
