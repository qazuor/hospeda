/**
 * @file drafts.ts
 *
 * POST /api/v1/ai/social/drafts
 *
 * Authenticated via the inbound `x-hospeda-ai-key` API key PLUS an
 * `operator_pin` in the request body.
 *
 * PIN verification approach (HOS-64 / SPEC-297a G-4, T-021):
 *   The plaintext operator PIN is stored as the `operator_pin` credential in
 *   the social credentials vault (AES-256-GCM at rest). The handler decrypts
 *   it via `getDecryptedSocialCredential` and uses `timingSafeEqual` on the
 *   raw bytes to prevent timing attacks.
 *
 * HTTP mapping:
 *   201 — success
 *   400 — draft's hashtag count exceeds a configured max_hashtags_<platform>
 *   401 — missing / invalid api-key (handled by middleware)
 *   403 — missing / invalid operator_pin
 *   409 — duplicate draftId
 *   422 — zero valid targets OR schema validation failure
 *   500 — unexpected internal error
 *
 * @module routes/ai/social/drafts
 * @see SPEC-254 T-029
 */

import { timingSafeEqual } from 'node:crypto';
import { CreateSocialDraftResponseSchema, CreateSocialDraftSchema } from '@repo/schemas';
import { SocialDraftIngestionService, SocialImagePipelineService } from '@repo/service-core';
import { getMediaProvider } from '../../../services/media';
import { getDecryptedSocialCredential } from '../../../services/social-credential-vault.service.js';
import { getActorFromContext } from '../../../utils/actor';
import { createApiKeyRoute } from '../../../utils/route-factory-tiered';

// ---------------------------------------------------------------------------
// Operator PIN validation
// ---------------------------------------------------------------------------

/**
 * Validates the incoming operator PIN against the plaintext PIN stored as the
 * `operator_pin` credential in the social credentials vault (HOS-64 T-021),
 * using a constant-time comparison to prevent timing attacks.
 *
 * The vault stores the PIN exactly as the operator types it into the Custom
 * GPT — no hashing — so the decrypted value and the value entered in the GPT
 * are guaranteed to be the same string.
 *
 * Returns `false` when:
 *  - No active `operator_pin` credential exists in the vault.
 *  - The provided PIN is absent/empty.
 *  - The PINs do not match (length or content).
 *
 * @param providedPin - Raw PIN string from the request body.
 * @returns `true` when the PIN is valid.
 */
async function validateOperatorPin(providedPin: string | undefined): Promise<boolean> {
    if (!providedPin || providedPin.trim() === '') return false;

    const vaultResult = await getDecryptedSocialCredential({ key: 'operator_pin' });
    const expectedPin = vaultResult.data?.plaintext;
    if (!expectedPin || expectedPin.trim() === '') return false;

    const provided = Buffer.from(providedPin, 'utf8');
    const expected = Buffer.from(expectedPin, 'utf8');

    // timingSafeEqual requires equal-length buffers; a length mismatch is a
    // guaranteed non-match, so short-circuit (this leaks only the length, not
    // the content).
    if (provided.length !== expected.length) return false;

    try {
        return timingSafeEqual(provided, expected);
    } catch {
        return false;
    }
}

// ---------------------------------------------------------------------------
// Error envelope helper
// ---------------------------------------------------------------------------

function buildErrorJson(
    code: string,
    message: string
): {
    success: false;
    error: { code: string; message: string };
} {
    return { success: false, error: { code, message } };
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/ai/social/drafts
 *
 * Accepts a Custom GPT social post draft, validates it, and stores it in the
 * database with status NEEDS_REVIEW / PENDING for admin review.
 *
 * Authentication: `x-hospeda-ai-key` header (API-key middleware) PLUS
 * `operatorPin` in the request body (validated inline before service call).
 */
export const socialDraftsRoute = createApiKeyRoute({
    method: 'post',
    path: '/',
    summary: 'GPT social draft submission',
    description:
        'Ingests a Custom GPT social post draft. Requires both the x-hospeda-ai-key header and a valid operator_pin in the body. Returns 201 with the new post ID on success. ' +
        'campaignSlug/batchSlug are resolve-or-create: an unknown slug creates a new active campaign/batch. Before submitting a new name, the GPT must check the catalog for a near-duplicate and confirm with the operator (see GET /catalog).',
    tags: ['AI - Social'],
    apiKeyConfig: {
        headerName: 'x-hospeda-ai-key',
        getExpectedKey: async () =>
            (await getDecryptedSocialCredential({ key: 'ai_social_key' })).data?.plaintext,
        actor: { id: 'gpt-action', name: 'Custom GPT Social Action' }
    },
    requestBody: CreateSocialDraftSchema,
    responseSchema: CreateSocialDraftResponseSchema,
    handler: async (ctx, _params, body: Record<string, unknown>) => {
        // ----------------------------------------------------------------
        // Step 1: Operator PIN validation (before calling the service)
        // ----------------------------------------------------------------
        const rawPin = typeof body.operatorPin === 'string' ? body.operatorPin : undefined;
        const pinValid = await validateOperatorPin(rawPin);
        if (!pinValid) {
            return ctx.json(buildErrorJson('FORBIDDEN', 'Invalid operator pin'), 403) as never;
        }

        // ----------------------------------------------------------------
        // Step 2: Call the ingestion service
        // ----------------------------------------------------------------
        const actor = getActorFromContext(ctx);

        // Wire the image pipeline so GPT-supplied images (public URL or OpenAI
        // file refs) are downloaded and re-uploaded to Cloudinary. Without an
        // injected pipeline the ingestion service skips media entirely and
        // reports assetStatus: 'pending' with no social_assets row created.
        // The pipeline is only built when a media provider is configured; in
        // non-development envs with missing Cloudinary creds getMediaProvider()
        // returns null and the draft is still created (media marked pending).
        const mediaProvider = getMediaProvider();
        const imagePipeline = mediaProvider
            ? new SocialImagePipelineService({}, mediaProvider)
            : undefined;
        const service = new SocialDraftIngestionService({}, imagePipeline);

        const result = await service.ingestDraft({
            // TYPE-WORKAROUND: the api-key route hands the validated body as unknown; narrow it to the draft input schema.
            payload: body as unknown as import('@repo/schemas').CreateSocialDraft,
            actorId: actor.id
        });

        // ----------------------------------------------------------------
        // Step 3: Map service result to HTTP response
        // ----------------------------------------------------------------
        switch (result.code) {
            case 'SUCCESS':
                return result.data;

            case 'CONFLICT':
                return ctx.json(buildErrorJson('CONFLICT', result.error.message), 409) as never;

            case 'ZERO_VALID_TARGETS':
                return ctx.json(
                    {
                        success: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: result.error.message,
                            details: result.error.warnings
                        }
                    },
                    422
                ) as never;

            case 'HASHTAG_LIMIT_EXCEEDED':
                return ctx.json(
                    {
                        success: false,
                        error: {
                            code: 'HASHTAG_LIMIT_EXCEEDED',
                            message: result.error.message,
                            details: result.error.violations
                        }
                    },
                    400
                ) as never;

            default:
                return ctx.json(
                    buildErrorJson(
                        'INTERNAL_ERROR',
                        (result as { error: { message: string } }).error.message
                    ),
                    500
                ) as never;
        }
    }
});
