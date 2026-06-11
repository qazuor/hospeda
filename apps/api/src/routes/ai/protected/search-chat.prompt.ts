/**
 * Per-request prompt builder for the conversational AI search route (SPEC-212 T-003).
 *
 * Mirrors {@link buildSearchIntentPrompt} (SPEC-199) — it produces the dynamic
 * `prompt` string passed to `aiService.generateObject({ feature: 'search' })`,
 * embedding the locale-specific amenity/feature allowlists. On top of that it
 * injects the **conversational state** so the model can refine an accumulated
 * filter set across turns:
 *
 *   1. the locale-specific amenity + feature slug allowlists (same as SPEC-199),
 *   2. the CURRENT FILTER SET (the accumulated entities from prior turns), when present,
 *   3. the bounded recent conversation history, and
 *   4. the new user message.
 *
 * The static slot-extraction contract and the "return the COMPLETE updated set"
 * instruction live in `DEFAULT_PROMPTS['search']` (extended by SPEC-212 T-002).
 * This builder only supplies the per-request data those instructions operate on.
 * When no current filter set is provided the CURRENT FILTER SET block is omitted,
 * so the model falls back to single-turn extraction — matching the system prompt's
 * "when NO current filter set is provided" branch.
 *
 * @module apps/api/routes/ai/protected/search-chat.prompt
 */

import type { AiChatMessage, SearchIntentEntities } from '@repo/schemas';
import { AMENITY_ALLOWLIST, FEATURE_ALLOWLIST } from './amenity-allowlist.js';

/**
 * Maximum number of trailing conversation messages embedded in the prompt.
 *
 * Bounds prompt size (and therefore latency — the local provider is slow) while
 * preserving enough context for the model to apply the latest message as a delta
 * against the CURRENT FILTER SET. Older messages are dropped; the accumulated
 * filter set already carries forward the decisions they produced.
 */
export const CONVERSATION_HISTORY_LIMIT = 8;

/**
 * Builds the two locale-specific allowlist lines shared with the SPEC-199
 * single-shot search prompt. The allowlist dictionaries remain the single source
 * of truth; only the de-duplicated join is reproduced here.
 *
 * @param locale - User locale selecting the allowlist dictionary.
 * @returns The amenity and feature allowlist lines, in order.
 */
const buildAllowlistLines = (locale: 'es' | 'en' | 'pt'): readonly string[] => {
    const amenityDict = (AMENITY_ALLOWLIST[locale] ?? AMENITY_ALLOWLIST.es) as Readonly<
        Record<string, string>
    >;
    const amenitySlugs = [...new Set(Object.values(amenityDict))].join(', ');

    const featureDict = (FEATURE_ALLOWLIST[locale] ?? FEATURE_ALLOWLIST.es) as Readonly<
        Record<string, string>
    >;
    const featureSlugs = [...new Set(Object.values(featureDict))].join(', ');

    return [
        `Allowed amenity slugs for this request (match user mentions to these; ignore any amenity not in this list): ${amenitySlugs}`,
        `Allowed feature slugs for this request (environment/atmosphere/aptitude/style only; match user mentions to these; ignore any feature not in this list): ${featureSlugs}`
    ];
};

/**
 * Produces the per-request `prompt` string for a single conversational-search turn.
 *
 * @param params - Receive-object.
 * @param params.currentFilters - Accumulated filter slots from prior turns. When
 *   absent or empty the CURRENT FILTER SET block is omitted (single-turn mode).
 * @param params.history - Prior conversation messages (excluding the new message);
 *   only the last {@link CONVERSATION_HISTORY_LIMIT} are embedded.
 * @param params.message - The new user message for this turn.
 * @param params.locale - User locale; selects the amenity/feature allowlists.
 * @returns The prompt string ready to pass as `prompt` to `generateObject`.
 *
 * @example
 * const prompt = buildConversationalSearchPrompt({
 *   currentFilters: { accommodationType: 'CABIN', minGuests: 4 },
 *   history: [{ role: 'user', content: 'cabaña para 4' }, { role: 'assistant', content: 'Encontré...' }],
 *   message: 'más barata, hasta 50 mil',
 *   locale: 'es'
 * });
 */
export function buildConversationalSearchPrompt({
    currentFilters,
    history,
    message,
    locale
}: {
    readonly currentFilters?: SearchIntentEntities;
    readonly history: readonly AiChatMessage[];
    readonly message: string;
    readonly locale: 'es' | 'en' | 'pt';
}): string {
    const lines: string[] = [...buildAllowlistLines(locale), ''];

    const hasFilters = currentFilters !== undefined && Object.keys(currentFilters).length > 0;
    if (hasFilters) {
        lines.push(
            'CURRENT FILTER SET (the accumulated state of this search conversation — return the COMPLETE updated set, applying the new message as a delta):',
            JSON.stringify(currentFilters),
            ''
        );
    }

    const recentHistory = history.slice(-CONVERSATION_HISTORY_LIMIT);
    if (recentHistory.length > 0) {
        lines.push(
            'Conversation so far (most recent last):',
            ...recentHistory.map((m) => `${m.role}: ${m.content}`),
            ''
        );
    }

    lines.push(`New user message: """${message}"""`);

    return lines.join('\n');
}
