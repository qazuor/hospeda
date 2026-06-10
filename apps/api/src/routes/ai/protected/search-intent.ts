/**
 * AI NL search-intent route module (SPEC-199 §5.1, §5.5).
 *
 * ## What lives here
 *
 * - `buildSearchIntentPrompt` — pure helper that produces the per-request
 *   `prompt` string passed to `aiService.generateObject({ feature: 'search' })`.
 *   It embeds the locale-specific amenity slug list, the locale-specific feature
 *   slug list, and the user query. The engine prepends `DEFAULT_PROMPTS['search']`
 *   (the static slot-extraction contract) automatically — this helper provides
 *   ONLY the dynamic context.
 *
 * ## What does NOT live here yet
 *
 * - The route handler (`searchIntentRoute`) is added by T-010 once the schema
 *   and mapper tasks (T-005 … T-009) are complete.
 *
 * @module apps/api/routes/ai/protected/search-intent
 */

import { AMENITY_ALLOWLIST, FEATURE_ALLOWLIST } from './amenity-allowlist.js';

// ─── Prompt builder ───────────────────────────────────────────────────────────

/**
 * Builds the per-request `prompt` string for
 * `aiService.generateObject({ feature: 'search', prompt, locale })`.
 *
 * The AI engine automatically prepends `DEFAULT_PROMPTS['search']` (the full
 * slot-extraction contract from `packages/ai-core`) as the system context before
 * this string. This helper therefore provides ONLY the dynamic per-request
 * context:
 *
 * 1. A line listing the allowed amenity slugs for the given locale
 *    (de-duplicated unique values from `AMENITY_ALLOWLIST[locale]`).
 * 2. A line listing the allowed feature slugs for the given locale
 *    (de-duplicated unique values from `FEATURE_ALLOWLIST[locale]`).
 * 3. A blank separator line.
 * 4. The raw user query, quoted in triple double-quotes for unambiguous parsing.
 *
 * If `locale` is not a recognised key in the allowlist dictionaries the helper
 * falls back silently to the `'es'` (Spanish) dictionary.
 *
 * @param query  - Raw user NL query (already validated against max 500 chars).
 * @param locale - User locale; controls which allowlist dictionary is selected.
 * @returns Prompt string ready to pass as `prompt` to `generateObject`.
 *
 * @example
 * ```ts
 * const prompt = buildSearchIntentPrompt({ query: 'cabaña con pileta', locale: 'es' });
 * // Starts with:
 * // "Allowed amenity slugs for this request …: pool, wifi, bbq, …"
 * // "Allowed feature slugs for this request …: river_front, …"
 * // ""
 * // "User query: """cabaña con pileta""""
 * ```
 */
export function buildSearchIntentPrompt({
    query,
    locale
}: {
    readonly query: string;
    readonly locale: 'es' | 'en' | 'pt';
}): string {
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
        `Allowed feature slugs for this request (environment/atmosphere/aptitude/style only; match user mentions to these; ignore any feature not in this list): ${featureSlugs}`,
        '',
        `User query: """${query}"""`
    ].join('\n');
}
