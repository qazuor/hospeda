/**
 * @file result.ts
 *
 * POST /api/v1/integrations/make/social/jobs/{targetId}/result
 *
 * Inbound Make.com result callback: Make calls this endpoint after attempting
 * to publish to a social platform, reporting whether the publish succeeded or failed.
 *
 * Authentication: static inbound API key in `x-hospeda-make-key` header.
 * No session or Better Auth required — machine-to-machine.
 *
 * @module routes/integrations/make/social/jobs/result
 * @see SPEC-254 T-048, US-13
 */

import {
    IdSchema,
    MakeResultCallbackResponseSchema,
    MakeResultCallbackSchema
} from '@repo/schemas';
import { SocialPublishDispatchService } from '@repo/service-core';
import { env } from '../../../../../utils/env';
import { apiLogger } from '../../../../../utils/logger';
import { createApiKeyRoute } from '../../../../../utils/route-factory-tiered';

const dispatchService = new SocialPublishDispatchService({ logger: apiLogger });

/**
 * POST /api/v1/integrations/make/social/jobs/{targetId}/result
 *
 * Make.com calls this endpoint after attempting to publish to a social platform.
 * Marks the target as PUBLISHED (SUCCESS) or handles FAILED with retry / exhaustion
 * logic, then cascades post-level status.
 *
 * Errors:
 *  - 401 — missing or invalid `x-hospeda-make-key` (middleware)
 *  - 404 — target not found (NOT_FOUND)
 *  - 422 — invalid status value (VALIDATION_ERROR)
 */
export const makeResultCallbackRoute = createApiKeyRoute({
    method: 'post',
    path: '/{targetId}/result',
    summary: 'Make.com result callback',
    description:
        'Make.com calls this endpoint after attempting to publish a social post. Records the publish outcome (SUCCESS or FAILED), applies retry/exhaustion logic, and cascades post-level status.',
    tags: ['Integrations - Make'],
    apiKeyConfig: {
        headerName: 'x-hospeda-make-key',
        getExpectedKey: () => env.HOSPEDA_MAKE_INBOUND_KEY,
        actor: { id: 'make-callback', name: 'Make.com Callback' }
    },
    requestParams: { targetId: IdSchema },
    requestBody: MakeResultCallbackSchema,
    responseSchema: MakeResultCallbackResponseSchema,
    successStatusCode: 200,
    handler: async (
        _ctx: unknown,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const targetId = params.targetId as string;

        return await dispatchService.handleMakeCallbackResult({
            targetId,
            status: body.status as 'SUCCESS' | 'FAILED',
            externalPostId: body.externalPostId as string | undefined,
            externalPostUrl: body.externalPostUrl as string | undefined,
            makeRunId: body.makeRunId as string | undefined,
            errorMessage: body.errorMessage as string | undefined
        });
    }
});
