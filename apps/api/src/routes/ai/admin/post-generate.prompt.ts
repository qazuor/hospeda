/**
 * Prompt builder of the admin `post_generate` route (SPEC-223).
 *
 * Kept apart from the route module so it can be imported without loading the
 * route's middleware and environment (the HOS-2217 AI sweep renders requests
 * with it).
 *
 * @module apps/api/routes/ai/admin/post-generate.prompt
 */

import type { AiPostGenerateRequest } from '@repo/schemas';

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
