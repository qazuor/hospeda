/**
 * @file ai-settings-features.utils.ts
 * @description The feature list, defaults and form hydration for the AI settings page.
 *
 * Extracted from `settings.tsx` so the three things that MUST agree with
 * `AiFeatureSchema` — the rendered list, the defaults map and the hydration of
 * a server response into form values — can be asserted against the enum by
 * `ai-settings-features.utils.test.ts` instead of living as unreachable consts
 * inside a route module.
 *
 * ## Why this coupling is load-bearing (HOS-1220)
 *
 * `AiFeaturesMapSchema` is a FULL `z.record` over `AiFeatureSchema`, used on both
 * write boundaries: the PUT request body and the parse `readAiSettings` performs
 * on every read. That makes a missing feature key fail in two directions:
 *
 * - Missing from a form submission → the PUT body is incomplete and the save is
 *   rejected.
 * - Missing from the STORED blob → `readAiSettings` throws `AiSettingsParseError`
 *   upstream of `createConfiguredAiService`, so EVERY AI feature answers 400.
 *   Two unconfigured keys took down the seven that were configured.
 *
 * HOS-400 widened the enum with `chat_gastronomy` and `chat_experience` and
 * updated `AiFeatureId` and `FEATURE_LABELS`, but not the lists here — so the
 * operator could neither see nor configure the two features whose absence was
 * breaking everything. The guard test exists so the next enum member cannot
 * repeat that.
 */

import type { AiFeatureId, AiSettingsValue } from '@/features/ai-settings';

/**
 * Every feature the settings form renders and submits, in display order.
 *
 * The three chats sit together: they are one product, split per vertical so each
 * vertical's monthly quota counts its own `ai_usage` rows (HOS-400).
 */
export const ALL_FEATURES: readonly AiFeatureId[] = [
    'text_improve',
    'chat',
    'chat_gastronomy',
    'chat_experience',
    'search',
    'support',
    'translate',
    'accommodation_import',
    'post_generate'
];

/**
 * The neutral per-feature configuration used for a feature the stored blob does
 * not carry: switched off, routed at the `stub` provider.
 *
 * It calls no real provider and spends nothing — it only makes the document
 * complete enough to parse and to submit.
 */
const NEUTRAL_FEATURE_CONFIG = {
    enabled: false,
    primaryProvider: 'stub',
    fallbackChain: [],
    model: 'gpt-4o-mini',
    params: {}
} as const;

/** Default settings blob used when the API returns an empty/missing value. */
export const DEFAULT_SETTINGS: AiSettingsValue = {
    providers: {
        openai: { enabled: false },
        anthropic: { enabled: false },
        stub: { enabled: true }
    },
    features: Object.fromEntries(
        ALL_FEATURES.map((featureId) => [featureId, { ...NEUTRAL_FEATURE_CONFIG }])
    ) as AiSettingsValue['features']
};

/**
 * Merges a server settings blob with the defaults so every feature key exists.
 *
 * Derived from {@link ALL_FEATURES} rather than spelled out key by key: the
 * hand-written version silently dropped the two features HOS-400 added, and a
 * key missing here goes out as an incomplete PUT body that the full-record
 * schema rejects.
 *
 * @param settings - The blob from `GET /api/v1/admin/ai/settings`, or `undefined`
 *   before it loads.
 * @returns A complete blob safe to seed the form with.
 */
export function toFormValues(settings: AiSettingsValue | undefined): AiSettingsValue {
    if (!settings) {
        return DEFAULT_SETTINGS;
    }

    const features = Object.fromEntries(
        ALL_FEATURES.map((featureId) => [
            featureId,
            settings.features[featureId] ?? DEFAULT_SETTINGS.features[featureId]
        ])
    ) as AiSettingsValue['features'];

    return {
        providers: settings.providers ?? DEFAULT_SETTINGS.providers,
        features
    };
}
