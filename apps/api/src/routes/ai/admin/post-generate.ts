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

import type { AiService } from '@repo/ai-core';
import {
    AiPostGenerateDraftGenerationSchema,
    AiPostGenerateDraftSchema,
    AiPostGenerateRequestSchema,
    PermissionEnum
} from '@repo/schemas';
import type { AiPostGenerateDraft, AiPostGenerateRequest } from '@repo/schemas';
import { adminAuthMiddleware } from '../../../middlewares/authorization.js';
import { createConfiguredAiService } from '../../../services/ai-service.factory.js';
import { mapAiEngineErrorToHttpStatus } from '../../../utils/ai-error-mapper.js';
import { createRouter } from '../../../utils/create-app.js';
import { apiLogger } from '../../../utils/logger.js';

// ---------------------------------------------------------------------------
// Zod-version bridge
// ---------------------------------------------------------------------------

/**
 * Zod-version-bridged parameter type for `AiService.generateObject`'s second
 * argument. `@repo/schemas` and `@repo/ai-core` pin the same Zod major but pnpm
 * may resolve them to different patch versions, producing a nominal `ZodType`
 * mismatch. The runtime schema is structurally identical and the explicit
 * `AiPostGenerateDraftSchema.safeParse` below enforces the contract.
 * Mirrors the cast pattern established in `search-chat.ts` and `import-from-url.ts`.
 */
type GenerateObjectSchema = Parameters<AiService['generateObject']>[1];

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
    const locale = input.locale ?? 'es';
    // The engine passes `locale` as metadata, but the model only writes in the
    // requested language if the concrete locale is stated in the prompt itself.
    // Without this, the model defaults to the topic's language (SPEC-223 smoke
    // found locale=en producing Spanish output).
    const langName = locale === 'en' ? 'English' : locale === 'pt' ? 'Portuguese' : 'Spanish';
    return `${cat}Tone: ${tone}. Write the entire output (title, summary, content) in ${langName} (${locale}).\n\nTopic: ${input.topic}\n\nKey points:\n${points}`;
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

        // Use the LOOSE schema (no minLength/maxLength bounds) for the provider call.
        // Constrained-decoding runtimes (llama.cpp/Ollama) crash building a GBNF grammar
        // for large length bounds; structural shape is all the provider needs.
        // The strict bounds are enforced below via AiPostGenerateDraftSchema.safeParse.
        // TYPE-WORKAROUND: pnpm may resolve @repo/schemas and @repo/ai-core to different
        // Zod patch versions (4.3.x vs 4.4.x), causing a nominal ZodType mismatch; the
        // runtime schemas are structurally identical and AiPostGenerateDraftSchema.safeParse
        // enforces the contract. Mirrors the cast pattern in search-chat.ts / import-from-url.ts.
        const outputSchema = AiPostGenerateDraftGenerationSchema as unknown as GenerateObjectSchema; // TYPE-WORKAROUND

        /**
         * Calls the AI engine once and validates the result against the STRICT
         * schema. Returns the validated draft or `null` if validation fails.
         *
         * @returns Validated `AiPostGenerateDraft` or `null` on parse failure.
         */
        const attemptGenerate = async (): Promise<{
            draft: AiPostGenerateDraft;
            provider: string;
            model: string;
            usage: { promptTokens: number; completionTokens: number; totalTokens: number };
        } | null> => {
            const result = await aiService.generateObject(
                { feature: 'post_generate', prompt, locale },
                outputSchema
            );
            const draftParsed = AiPostGenerateDraftSchema.safeParse(result.object);
            if (!draftParsed.success) {
                return null;
            }
            return {
                draft: draftParsed.data,
                provider: result.provider,
                model: result.model,
                usage: result.usage
            };
        };

        let attempt = await attemptGenerate();

        if (attempt === null) {
            apiLogger.warn(
                { topic: input.topic },
                'admin-ai-post-generate: strict validation failed on first attempt — retrying once'
            );
            attempt = await attemptGenerate();
        }

        if (attempt === null) {
            apiLogger.warn(
                { topic: input.topic },
                'admin-ai-post-generate: strict validation failed on retry — returning 422'
            );
            return c.json(
                {
                    success: false,
                    error: {
                        code: 'DRAFT_VALIDATION_FAILED',
                        message:
                            'The generated draft did not meet the required format after two attempts'
                    }
                },
                422
            );
        }

        apiLogger.info(
            {
                provider: attempt.provider,
                model: attempt.model,
                usage: attempt.usage
            },
            'admin-ai-post-generate: draft generated successfully'
        );

        return c.json({ success: true, data: attempt.draft });
    } catch (error) {
        const mapped = mapAiEngineErrorToHttpStatus(error);

        if (mapped !== undefined) {
            // Special-case mappings for client-visible error codes:
            // - MODERATION_BLOCKED → MODERATION_FAILED (US-4 §422)
            // - CEILING_HIT        → AI_CEILING_HIT    (US-7 §429; panel maps on this exact code)
            const clientCode =
                mapped.code === 'MODERATION_BLOCKED'
                    ? 'MODERATION_FAILED'
                    : mapped.code === 'CEILING_HIT'
                      ? 'AI_CEILING_HIT'
                      : mapped.code;

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
