/**
 * Admin AI post-generation route (SPEC-223 T-005).
 *
 * Mounted at `POST /api/v1/admin/ai/post-generate` by the main router
 * (apps/api/src/routes/index.ts) via the admin AI barrel.
 *
 * Accepts a topic + key points (plus optional category, tone, and locale),
 * calls `aiService.generateObject` with the `post_generate` feature, and
 * returns a single JSON body containing a validated `AiPostGenerateDraft`
 * (title, summary, content).
 *
 * ## NOT streaming
 *
 * This route is a plain buffered POST, NOT SSE. `ai-core` exposes no
 * `streamObject` capability; `generateObject` is buffered (Promise-based)
 * and validates the structured output against `AiPostGenerateDraftSchema`
 * via the Zod schema passed to the engine. The admin panel shows a spinner
 * while the request is in flight and populates the three fields on success.
 *
 * ## Safety pipeline
 *
 * Input and output moderation are applied INTERNALLY by the engine inside
 * `generateObject` (same as `generateText` and `streamText`). No extra
 * moderation call is needed in the route. A moderation block throws
 * `AiModerationBlockedError` (engineCode `MODERATION_BLOCKED`) which is
 * mapped to HTTP 422 by `mapAiEngineErrorToHttpStatus`.
 *
 * ## System prompt
 *
 * The `post_generate` system prompt and hard-guardrail rules are resolved
 * and composed AUTOMATICALLY by the engine via `resolveSystemPrompt` +
 * `composeSystemPrompt` before the provider call. No explicit prompt
 * assembly is needed here beyond the user-turn built by
 * `buildPostGeneratePrompt`.
 *
 * ## Permission gate
 *
 * `adminAuthMiddleware` uses `hasAllPermissions` (AND semantics). The route
 * is gated on `[PermissionEnum.POST_CREATE]` — the natural gate for
 * generating a draft that will be shaped into a new or edited post. Editors
 * with `POST_CREATE` cover both new and edit flows (creating a draft is a
 * create-level operation regardless of whether the editor is editing an
 * existing post).
 *
 * @module apps/api/routes/ai/admin/post-generate
 */

import {
    AiPostGenerateDraftSchema,
    AiPostGenerateRequestSchema,
    PermissionEnum
} from '@repo/schemas';
import type { AiPostGenerateRequest } from '@repo/schemas';
import { adminAuthMiddleware } from '../../../middlewares/authorization.js';
import { createConfiguredAiService } from '../../../services/ai-service.factory.js';
import { mapAiEngineErrorToHttpStatus } from '../../../utils/ai-error-mapper.js';
import { createRouter } from '../../../utils/create-app.js';
import { apiLogger } from '../../../utils/logger.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maximum number of tokens the AI provider may generate per call.
 *
 * Kept conservative (2048) to bound per-call cost while still allowing
 * posts with a typical title (≤150), summary (≤300), and rich-text body
 * (100–50000 chars, but prose-dense HTML typically fits in ~1500 tokens).
 */
const MAX_TOKENS = 2048;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

/**
 * Builds the user turn sent to the `post_generate` engine capability.
 *
 * The system prompt and hard-guardrail rules are owned by the engine
 * (`DEFAULT_PROMPTS['post_generate']` / `DEFAULT_RULES['post_generate']`
 * or SUPER_ADMIN-overridable versions in `ai_prompt_versions`) and are
 * resolved automatically inside the engine before the provider call.
 * This function only composes the user-facing instruction turn.
 *
 * Exported separately so T-008 (unit tests) can assert on the exact prompt
 * string for each combination of inputs.
 *
 * @param input - The validated post-generation request body.
 * @returns The user turn sent to the AI provider.
 */
export function buildPostGeneratePrompt(input: AiPostGenerateRequest): string {
    const points = input.points.map((p, i) => `${i + 1}. ${p}`).join('\n');
    const tone = input.tone ?? 'neutral';
    const cat = input.category ? `Category: ${input.category}. ` : '';
    return `${cat}Tone: ${tone}.\n\nTopic: ${input.topic}\n\nKey points:\n${points}`;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const adminAiPostGenerateRoute = createRouter();

/**
 * Require admin-level authentication for all routes on this router.
 *
 * `adminAuthMiddleware` checks:
 * 1. The actor is authenticated (not a guest).
 * 2. The actor has `ACCESS_PANEL_ADMIN` or `ACCESS_API_ADMIN` (admin tier).
 * 3. The actor has ALL of the specified `requiredPermissions` (AND gate).
 *
 * `POST_CREATE` is the natural gate for generating a post draft: it covers
 * both the new-post and edit-post flows (producing a draft is a
 * create-level operation in both cases).
 */
adminAiPostGenerateRoute.use('*', adminAuthMiddleware([PermissionEnum.POST_CREATE]));

// ---------------------------------------------------------------------------
// POST / — generate a post draft (buffered JSON response)
// ---------------------------------------------------------------------------

/**
 * Generates an AI-authored post draft from a topic and key points.
 *
 * @route POST /api/v1/admin/ai/post-generate
 * @auth Admin — requires `PermissionEnum.POST_CREATE`
 *
 * @returns 200 `{ success: true, data: AiPostGenerateDraft }` on success.
 * @returns 400 `{ success: false, error: { code: 'VALIDATION_ERROR' } }` for invalid body.
 * @returns 422 `{ success: false, error: { code: 'MODERATION_FAILED' } }` when content is blocked.
 * @returns 429 `{ success: false, error: { code: 'AI_CEILING_HIT' } }` when cost ceiling is hit.
 * @returns 503 `{ success: false, error: { code: '...' } }` when all providers fail / feature disabled.
 */
adminAiPostGenerateRoute.post('/', async (c) => {
    const rawBody = await c.req.json();
    const parsed = AiPostGenerateRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
        return c.json(
            {
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid request body',
                    details: parsed.error.issues.map((e) => ({
                        field: e.path.join('.'),
                        message: e.message
                    }))
                }
            },
            400
        );
    }

    const input = parsed.data;
    const prompt = buildPostGeneratePrompt(input);
    const locale = input.locale ?? 'es';

    apiLogger.info(
        {
            topic: input.topic,
            pointCount: input.points.length,
            category: input.category,
            tone: input.tone ?? 'neutral',
            locale
        },
        'admin-ai-post-generate: generating post draft'
    );

    try {
        const aiService = await createConfiguredAiService();

        const result = await aiService.generateObject(
            {
                feature: 'post_generate',
                prompt,
                locale,
                maxTokens: MAX_TOKENS
            },
            AiPostGenerateDraftSchema
        );

        apiLogger.info(
            {
                provider: result.provider,
                model: result.model,
                usage: result.usage
            },
            'admin-ai-post-generate: draft generated successfully'
        );

        return c.json({ success: true, data: result.object });
    } catch (error) {
        const mapped = mapAiEngineErrorToHttpStatus(error);

        if (mapped !== undefined) {
            // Special-case: the spec requires MODERATION_FAILED (not MODERATION_BLOCKED)
            // as the client-visible code for content-policy rejections (US-4 §422).
            const clientCode =
                mapped.code === 'MODERATION_BLOCKED' ? 'MODERATION_FAILED' : mapped.code;

            apiLogger.warn(
                { code: clientCode, status: mapped.status },
                'admin-ai-post-generate: AI engine error'
            );

            // Map CEILING_HIT to 429 (rate-limit semantics) as required by T-008 spec.
            const httpStatus =
                mapped.code === 'CEILING_HIT' ? (429 as const) : (mapped.status as number);

            return c.json(
                { success: false, error: { code: clientCode, message: clientCode } },
                httpStatus as 422 | 429 | 500 | 502 | 503
            );
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        apiLogger.error({ error: errorMessage }, 'admin-ai-post-generate: unexpected error');
        return c.json(
            {
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
            },
            500
        );
    }
});
