/**
 * @file playground-features.utils.ts
 * @description Which AI features the debug Playground can actually exercise.
 *
 * The Playground drives features through a single free-text message box (plus an
 * optional accommodation combobox) and an SSE token stream. Only `chat` and
 * `search` fit that shape. The other features either have no endpoint yet
 * (`support`), need extra structured inputs (`text_improve`'s field type,
 * `post_generate`'s topic + points, `translate`'s entity reference), or are
 * plain non-streaming endpoints with their own dedicated admin UI
 * (`translate`, `accommodation_import`, `post_generate`). Those are disabled in
 * the feature selector so they can't be sent to the wrong endpoint and fail
 * silently. Broadening Playground support is tracked separately (see the
 * AI-playground follow-up issue).
 */

import type { AiFeatureId } from '@/features/ai-settings';

/** Features the Playground's single-message chat UI can actually drive. */
export const PLAYGROUND_SUPPORTED_FEATURES: readonly AiFeatureId[] = ['chat', 'search'];

/**
 * Short Spanish reason shown next to a feature that can't be tested from the
 * Playground, so the operator understands why it's disabled.
 */
export const PLAYGROUND_UNSUPPORTED_REASON: Readonly<Partial<Record<AiFeatureId, string>>> = {
    text_improve: 'requiere tipo de campo',
    // HOS-400 split the chat per vertical. The Playground's entity picker is an
    // accommodation combobox, so it cannot reference a gastronomy or experience
    // listing to chat about — the capability is the same, the fixture is not.
    chat_gastronomy: 'requiere una ficha de gastronomía',
    chat_experience: 'requiere una ficha de experiencia',
    support: 'sin endpoint',
    translate: 'usá su propia página',
    accommodation_import: 'usá importar por URL',
    post_generate: 'usá generar post'
};

/**
 * Whether a feature can be exercised from the Playground.
 *
 * @param feature - The AI feature id.
 * @returns `true` if the Playground can drive it, `false` if it must be disabled.
 */
export function isPlaygroundSupportedFeature(feature: AiFeatureId): boolean {
    return PLAYGROUND_SUPPORTED_FEATURES.includes(feature);
}
