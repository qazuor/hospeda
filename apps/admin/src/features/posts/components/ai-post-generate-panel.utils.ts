/**
 * @file ai-post-generate-panel.utils.ts
 * @description Pure utilities and constants for AiPostGeneratePanel (SPEC-223 T-009).
 *
 * Extracted from AiPostGeneratePanel.tsx to keep the component file under the
 * 500-line hard limit.
 *
 * ## Error code contract (as emitted by the API route):
 *
 * - `MODERATION_FAILED`  → HTTP 422 → `errorModeration`
 * - `AI_CEILING_HIT`     → HTTP 429 → `errorCeiling`
 * - `ENGINE_EXHAUSTED`   → HTTP 502 → `errorExhausted`
 * - other service-down codes (`FEATURE_DISABLED`, `NO_ENABLED_PROVIDER`,
 *   `PROVIDER_UNCONFIGURED`, `FEATURE_NOT_CONFIGURED`) → HTTP 503 → `errorExhausted`
 * - anything else        → `errorGeneric`
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

/** API path for the AI post-generation route. */
export const AI_POST_GENERATE_PATH = '/api/v1/admin/ai/post-generate';

/**
 * Resolves the API base URL from `VITE_API_URL`, mirroring the admin's other
 * AI fetch clients (e.g. `ai/-components/stream-chat.ts`). The admin app runs
 * on a different origin than the API, so a relative path would resolve against
 * the admin origin and 404. Falls back to an empty string (relative) when the
 * env var is absent — e.g. under jsdom in unit tests.
 *
 * @returns The API base URL without a trailing slash, or `''` if unset.
 */
function getApiBaseUrl(): string {
    const url = (import.meta.env as Record<string, string | undefined>).VITE_API_URL;
    return url ? url.replace(/\/$/, '') : '';
}

/**
 * Absolute URL for the AI post-generation endpoint.
 *
 * @returns The API base URL joined with {@link AI_POST_GENERATE_PATH}.
 */
export function getAiPostGenerateUrl(): string {
    return `${getApiBaseUrl()}${AI_POST_GENERATE_PATH}`;
}

/**
 * @deprecated Use {@link getAiPostGenerateUrl} — a bare relative path resolves
 * against the admin origin (wrong port) and 404s. Kept as the path constant.
 */
export const AI_POST_GENERATE_ENDPOINT = AI_POST_GENERATE_PATH;

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
 * - `ENGINE_EXHAUSTED` (HTTP 502) → `errorExhausted`
 * - other service-down codes (HTTP 503) → `errorExhausted`
 *
 * HTTP status is used as a secondary signal so the correct key is still
 * returned even if the response body is missing or malformed. Note the
 * exhausted case is HTTP 502 (upstream gateway), not 503.
 *
 * @param status - HTTP status code from the fetch response.
 * @param code   - Error code extracted from `json.error.code`.
 * @returns The i18n key suffix string.
 */
export function mapErrorKey(status: number, code: string): string {
    if (status === 422 || code === 'MODERATION_FAILED') return 'errorModeration';
    if (status === 429 || code === 'AI_CEILING_HIT') return 'errorCeiling';
    // "Service unavailable" family. `ENGINE_EXHAUSTED` (all providers failed) is
    // mapped to HTTP 502 by the API (`mapAiEngineErrorToHttpStatus`), NOT 503, so
    // the bare `status === 503` check missed it and fell through to `errorGeneric`
    // (SPEC-223 smoke found this). The 503 branch still covers the other
    // service-down codes (FEATURE_DISABLED, NO_ENABLED_PROVIDER,
    // PROVIDER_UNCONFIGURED, FEATURE_NOT_CONFIGURED).
    if (status === 502 || status === 503 || code === 'ENGINE_EXHAUSTED') {
        return 'errorExhausted';
    }
    return 'errorGeneric';
}
