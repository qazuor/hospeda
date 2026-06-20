/**
 * @file ai-post-generate-panel.utils.ts
 * @description Pure utilities and constants for AiPostGeneratePanel (SPEC-223 T-009).
 *
 * Extracted from AiPostGeneratePanel.tsx to keep the component file under the
 * 500-line hard limit.
 *
 * ## Error code contract (as emitted by the API route):
 *
 * - `MODERATION_FAILED` → HTTP 422 → `errorModeration`
 * - `AI_CEILING_HIT`   → HTTP 429 → `errorCeiling`
 * - `exhausted` codes  → HTTP 503 → `errorExhausted`
 * - anything else      → `errorGeneric`
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Spanish display labels for PostCategoryEnum values.
 * Mirrors the labels used in basic-info.consolidated.ts.
 */
export const POST_CATEGORY_LABELS: Record<string, string> = {
    EVENTS: 'Eventos',
    CULTURE: 'Cultura',
    GASTRONOMY: 'Gastronomía',
    NATURE: 'Naturaleza',
    TOURISM: 'Turismo',
    GENERAL: 'General',
    SPORT: 'Deporte',
    CARNIVAL: 'Carnaval',
    NIGHTLIFE: 'Vida Nocturna',
    HISTORY: 'Historia',
    TRADITIONS: 'Tradiciones',
    WELLNESS: 'Bienestar',
    FAMILY: 'Familia',
    TIPS: 'Consejos',
    ART: 'Arte',
    BEACH: 'Playa',
    RURAL: 'Rural',
    FESTIVALS: 'Festivales'
};

/** API endpoint for the AI post-generation route. */
export const AI_POST_GENERATE_ENDPOINT = '/api/v1/admin/ai/post-generate';

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

/**
 * Maps an API error response to the appropriate i18n key suffix.
 *
 * The suffix is used as `admin-pages.posts.aiGenerate.<suffix>`.
 *
 * Code-to-key mapping mirrors the exact codes emitted by the API route:
 * - `MODERATION_FAILED` (HTTP 422) → `errorModeration`
 * - `AI_CEILING_HIT`   (HTTP 429) → `errorCeiling`
 * - `exhausted` codes  (HTTP 503) → `errorExhausted`
 *
 * HTTP status is used as a secondary signal so the correct key is still
 * returned even if the response body is missing or malformed.
 *
 * @param status - HTTP status code from the fetch response.
 * @param code   - Error code extracted from `json.error.code`.
 * @returns The i18n key suffix string.
 */
export function mapErrorKey(status: number, code: string): string {
    if (status === 422 || code === 'MODERATION_FAILED') return 'errorModeration';
    if (status === 429 || code === 'AI_CEILING_HIT') return 'errorCeiling';
    if (status === 503 || code === 'exhausted') return 'errorExhausted';
    return 'errorGeneric';
}
