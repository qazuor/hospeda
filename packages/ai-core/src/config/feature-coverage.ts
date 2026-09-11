/**
 * Detecting an incomplete AI feature configuration (HOS-1220).
 *
 * `readAiSettings` reads through the PARTIAL response schema, so a stored blob
 * that does not carry every `AiFeature` key is returned instead of throwing.
 * That is deliberate — the per-feature fail-closed in `resolveFeatureConfig`
 * already refuses to run an unconfigured feature, and failing the whole
 * document instead took the entire AI layer down over two keys nobody had set.
 *
 * But an incomplete config is still a real defect that somebody must fix, and
 * the way HOS-1220 was found is the reason this module exists: the previous
 * failure produced ONE log line in twenty-four hours — the one the person
 * reproducing it caused. Nothing watched the AI layer, so a whole deploy went
 * by with every AI feature dead and no signal at all.
 *
 * This module is the detection half. The alerting half lives in the caller:
 * `@repo/ai-core` performs no observability side effects and has no logger (see
 * the isolation rules in CLAUDE.md), so `apps/api` calls this and reports
 * through `apiLogger` and Sentry, the same way it injects `recordEvent` rather
 * than letting the engine observe itself.
 *
 * @module ai-core/config/feature-coverage
 */

import { type AiFeature, AiFeatureSchema, type AiSettingsValueResponse } from '@repo/schemas';

/**
 * Returns the `AiFeature` members that the given settings blob does not
 * configure, in enum order.
 *
 * Pure: it reads the enum and the blob and returns a list. It logs nothing and
 * throws nothing — a `null` blob (no row yet) reports every feature as
 * unconfigured, which is the accurate answer for a platform nobody has set up.
 *
 * @param input - The settings blob to inspect, as returned by `readAiSettings`.
 * @returns The unconfigured feature keys. Empty when the config is complete.
 *
 * @example
 * ```ts
 * const missing = findUnconfiguredFeatures({ settings });
 * if (missing.length > 0) {
 *   logger.error({ missing }, 'ai_settings is missing feature configuration');
 * }
 * ```
 */
export function findUnconfiguredFeatures(input: {
    readonly settings: AiSettingsValueResponse | null;
}): readonly AiFeature[] {
    const { settings } = input;

    if (settings === null) {
        return AiFeatureSchema.options;
    }

    return AiFeatureSchema.options.filter((feature) => settings.features[feature] === undefined);
}
