/**
 * Prompt builder of the `text_improve` route (BETA-180).
 *
 * Kept apart from the route module so it can be imported without loading the
 * route's middleware and environment (the HOS-2217 AI sweep renders requests
 * with it).
 *
 * @module apps/api/routes/ai/protected/text-improve.prompt
 */

import type { AiTextImprove } from '@repo/schemas';

/**
 * Builds the user turn sent to the `text_improve` engine capability.
 *
 * The system prompt is owned by the engine (`DEFAULT_PROMPTS['text_improve']`
 * or a SUPER_ADMIN-overridable version in `ai_prompt_versions`) and is
 * resolved automatically by the engine before the provider call. This
 * function only composes the user-facing instruction + the field content.
 *
 * Exported separately so the route unit tests (T-005) can assert on the
 * built user turn for a given `fieldValue` + `fieldType` pair.
 *
 * The instruction is framed per `fieldType`: `description`/`summary` are
 * marketing-facing listing copy, whereas `faq_answer` is a factual guest
 * answer that must NOT be turned into sales copy. Both variants demand a
 * substantial rewrite (not a cosmetic edit) and strip any auto-generated
 * metadata prefix (BETA-180).
 *
 * @param input - The validated text-improvement request body.
 * @returns The user turn sent to the AI provider.
 */
export function buildTextImprovePrompt(input: AiTextImprove): string {
    const isFaq: boolean = input.fieldType === 'faq_answer';
    const fieldLabel: string = isFaq ? 'FAQ answer' : input.fieldType;
    const goal = isFaq
        ? 'Rewrite the following accommodation FAQ answer so it reads as a clear, complete, and genuinely helpful answer for a prospective guest. Do not turn a factual answer into marketing or sales copy.'
        : `Rewrite the following accommodation ${fieldLabel} so it reads as clear, engaging, and persuasive marketing copy for a tourism listing.`;
    return (
        `${goal} ` +
        `Substantially rework the wording, structure, and flow — do not just fix punctuation, expand abbreviations, or make other cosmetic edits. ` +
        `Remove any auto-generated metadata prefix that is not part of the ${fieldLabel} (for example a publication date, the listing type, or a category label such as "Entire home: country house"). ` +
        `Stay faithful to the facts: do not invent amenities, services, prices, distances, or claims that are not in the original. ` +
        `Reply with only the improved ${fieldLabel}, in the same language as the input, with no preamble, labels, or surrounding quotation marks.\n\n` +
        `${input.fieldValue}`
    );
}
