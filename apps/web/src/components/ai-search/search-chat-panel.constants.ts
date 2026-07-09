/**
 * @file search-chat-panel.constants.ts
 * @description Shared constants for the SearchChatPanel React island (SPEC-212 T-010).
 * Extracted out of SearchChatPanel.client.tsx (HOS-111 follow-up) to keep that
 * file under the repo's 500-line limit — pure data, no JSX/behavior.
 *
 * @module search-chat-panel.constants
 */

/**
 * Confidence threshold below which the low-confidence notice is shown
 * (SPEC-265 A2). When the model's self-assessed confidence is below this
 * value, the UI displays `aiSearch.lowConfidenceMessage` suggesting the
 * user reformulate their query. No numeric badge is shown.
 *
 * NOTE — intentionally distinct from the backend `fallbackToKeyword` cutoff
 * (`confidence < 0.5`, Q5 decision, see `ai-search-intent.schema.ts`). That
 * 0.5 cutoff drives keyword-search fallback (unused by this conversational
 * panel, which runs its own accommodations search); this 0.4 cutoff only
 * decides whether to render the reformulation hint. They answer different
 * questions, so they are not unified — keep them separate on purpose.
 */
export const LOW_CONFIDENCE_THRESHOLD = 0.4;

/**
 * Maximum content length for chat messages (SPEC-265 C2).
 * Matches the `.max(500)` on `AiChatMessageSchema.content` — the textarea
 * `maxLength` and the char counter both reference this constant.
 */
export const MAX_CONTENT_LENGTH = 500;

/**
 * i18n keys for the static example query pool (SPEC-265 B1a).
 * Shown as clickable chips in the empty state — clicking sends the query
 * immediately. Each key resolves to a localized natural-language query
 * that the AI search pipeline can handle.
 */
export const EXAMPLE_QUERY_KEYS = [
    'aiSearch.examples.query1',
    'aiSearch.examples.query2',
    'aiSearch.examples.query3',
    'aiSearch.examples.query4'
] as const;

/**
 * Maps accommodation type enum values to type-specific example query i18n keys
 * (SPEC-265 B1b — context-aware onboarding). When the page has an active
 * type context, the matching example is prepended to the pool, tailoring
 * the suggestions to what the user is browsing.
 */
export const TYPE_EXAMPLE_KEY: Record<string, string> = {
    APARTMENT: 'aiSearch.examples.typeApartment',
    HOUSE: 'aiSearch.examples.typeHouse',
    COUNTRY_HOUSE: 'aiSearch.examples.typeCountryHouse',
    CABIN: 'aiSearch.examples.typeCabin',
    HOTEL: 'aiSearch.examples.typeHotel',
    HOSTEL: 'aiSearch.examples.typeHostel',
    CAMPING: 'aiSearch.examples.typeCamping',
    ROOM: 'aiSearch.examples.typeRoom',
    MOTEL: 'aiSearch.examples.typeMotel',
    RESORT: 'aiSearch.examples.typeResort'
};
