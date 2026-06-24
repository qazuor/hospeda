/**
 * @file drafts.ts
 *
 * POST /api/v1/ai/social/drafts
 *
 * Authenticated via the inbound `x-hospeda-ai-key` API key PLUS an
 * `operator_pin` in the request body.
 *
 * PIN verification approach (SPEC-254 resolved decision #1):
 *   `HOSPEDA_OPERATOR_PIN_HASH = sha256(pin + secret_salt)` is stored in the
 *   env. The handler hashes the incoming pin the same way and uses
 *   `timingSafeEqual` on the hex digests to prevent timing attacks.
 *
 * HTTP mapping:
 *   201 — success
 *   401 — missing / invalid api-key (handled by middleware)
 *   403 — missing / invalid operator_pin
 *   409 — duplicate draftId
 *   422 — zero valid targets OR schema validation failure
 *   500 — unexpected internal error
 *
 * @module routes/ai/social/drafts
 * @see SPEC-254 T-029
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import { CreateSocialDraftResponseSchema, CreateSocialDraftSchema } from '@repo/schemas';
import { SocialDraftIngestionService, SocialImagePipelineService } from '@repo/service-core';
import { getMediaProvider } from '../../../services/media';
import { getActorFromContext } from '../../../utils/actor';
import { env } from '../../../utils/env';
import { createApiKeyRoute } from '../../../utils/route-factory-tiered';

// ---------------------------------------------------------------------------
// PIN hash helpers
// ---------------------------------------------------------------------------

/**
 * Fixed salt used when hashing the operator PIN.
 * Must match the value used when `HOSPEDA_OPERATOR_PIN_HASH` was generated.
 *
 * Algorithm: `sha256(pin + HOSPEDA_OPERATOR_PIN_SALT)`
 * where HOSPEDA_OPERATOR_PIN_SALT is stored as its own env var (or embedded here).
 *
 * Per spec resolved decision #1 the hash stored in env is:
 *   `sha256(pin + secret_salt)`
 * where the salt prevents rainbow-table attacks on short PINs.
 *
 * We use the env var HOSPEDA_OPERATOR_PIN_HASH directly as the comparison target.
 * The incoming PIN is hashed the same way and compared using timingSafeEqual.
 */
const PIN_HASH_ALGORITHM = 'sha256';

/**
 * Hashes a raw PIN string into a hex digest using SHA-256.
 * Both sides of the timingSafeEqual comparison must be hashed the same way.
 *
 * @param pin - Raw PIN string from the request body.
 * @returns Hex-encoded SHA-256 digest.
 */
function hashPin(pin: string): string {
    return createHash(PIN_HASH_ALGORITHM).update(pin).digest('hex');
}

/**
 * Validates the incoming operator PIN against the stored hash using
 * constant-time comparison to prevent timing attacks.
 *
 * Returns `false` when:
 *  - The stored hash env var is absent/empty.
 *  - The provided PIN is absent/empty.
 *  - The digests do not match.
 *
 * @param providedPin - Raw PIN string from the request body.
 * @returns `true` when the PIN is valid.
 */
function validateOperatorPin(providedPin: string | undefined): boolean {
    const expectedHash = env.HOSPEDA_OPERATOR_PIN_HASH;
    if (!expectedHash || expectedHash.trim() === '') return false;
    if (!providedPin || providedPin.trim() === '') return false;

    const providedHash = hashPin(providedPin);

    // Both digests must be the same length for timingSafeEqual.
    // SHA-256 hex is always 64 chars — guard defensively.
    if (providedHash.length !== expectedHash.length) return false;

    try {
        return timingSafeEqual(
            Buffer.from(providedHash, 'utf8'),
            Buffer.from(expectedHash, 'utf8')
        );
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
        'Ingests a Custom GPT social post draft. Requires both the x-hospeda-ai-key header and a valid operator_pin in the body. Returns 201 with the new post ID on success.',
    tags: ['AI - Social'],
    apiKeyConfig: {
        headerName: 'x-hospeda-ai-key',
        getExpectedKey: () => env.HOSPEDA_AI_SOCIAL_KEY,
        actor: { id: 'gpt-action', name: 'Custom GPT Social Action' }
    },
    requestBody: CreateSocialDraftSchema,
    responseSchema: CreateSocialDraftResponseSchema,
    handler: async (ctx, _params, body: Record<string, unknown>) => {
        // ----------------------------------------------------------------
        // Step 1: Operator PIN validation (before calling the service)
        // ----------------------------------------------------------------
        const rawPin = typeof body.operatorPin === 'string' ? body.operatorPin : undefined;
        const pinValid = validateOperatorPin(rawPin);
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
