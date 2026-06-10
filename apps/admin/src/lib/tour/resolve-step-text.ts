/**
 * resolve-step-text — pure locale resolver for tour step i18n fields.
 *
 * Resolves a tri-locale `I18nLabel` (`{ es, en, pt }`) to the best available
 * string for the requested locale, following the same fallback chain used by
 * `useLocalizedLabel` and `resolveEntryLocale` (SPEC-175):
 *
 *   1. `field[locale]`   — if the requested locale is supported and non-empty.
 *   2. `field['es']`     — project-default locale (Argentina market, always present).
 *   3. First non-empty   — safety net (unreachable in practice when step text
 *                          is authored against `I18nLabelSchema`).
 *
 * **Design choice vs. `resolveEntryLocale` (SPEC-175):**
 * The What's New `resolveEntryLocale` function uses an `I18nField` interface
 * where `en` and `pt` are optional. Tour steps use `I18nLabel` from the IA
 * config (all three locales are required by `I18nLabelSchema`). Despite the
 * shape difference, the fallback chain is identical, so this module aligns
 * its logic with `resolveEntryLocale` rather than duplicating or inventing a
 * new chain. A shared generic could be extracted in a future cleanup; for now
 * a tour-local function aligned in behaviour is cleaner than a cross-concern
 * dependency on SPEC-175's `resolveEntryLocale`.
 *
 * Pure function — no React, no DOM, no side effects. Unit-testable in isolation.
 *
 * @module lib/tour/resolve-step-text
 * @see apps/admin/src/lib/whats-new/resolve-entry-locale.ts — shape it mirrors
 * @see apps/admin/src/hooks/use-localized-label.ts           — React hook counterpart
 * @see SPEC-174 §7.3, D7
 */

// ============================================================================
// Input type
// ============================================================================

/**
 * Tri-locale label where all three keys are required (matches `I18nLabelSchema`).
 * Kept local so this pure helper has zero runtime dependency on the Zod schema.
 */
export interface TourI18nLabel {
    /** Spanish — required project default locale. */
    readonly es: string;
    /** English — required per `I18nLabelSchema`. */
    readonly en: string;
    /** Portuguese — required per `I18nLabelSchema`. */
    readonly pt: string;
}

/** Input shape for {@link resolveStepText}. */
export interface ResolveStepTextInput {
    /** The tri-locale label object to resolve. */
    readonly field: TourI18nLabel;
    /**
     * The target locale (e.g. `'es'`, `'en'`, `'pt'`).
     * Unknown values fall back through the chain.
     */
    readonly locale: string;
}

// ============================================================================
// Exported function
// ============================================================================

/**
 * Resolves a `TourI18nLabel` to the best available string for the given locale.
 *
 * Fallback chain:
 * 1. `field[locale]` — if locale is `'es'`, `'en'`, or `'pt'` and the value is non-empty.
 * 2. `field.es`      — project default (always required, always non-empty).
 * 3. First non-empty value in `field` — safety net (unreachable in practice).
 *
 * @param input - `{ field, locale }` pair.
 * @returns The resolved string, never empty when `field.es` is present.
 *
 * @example
 * ```ts
 * resolveStepText({ field: { es: 'Título', en: 'Title', pt: 'Título' }, locale: 'en' });
 * // 'Title'
 *
 * resolveStepText({ field: { es: 'Título', en: 'Title', pt: 'Título' }, locale: 'fr' });
 * // 'Título'  — unknown locale falls back to es
 *
 * resolveStepText({ field: { es: 'Título', en: 'Title', pt: 'Título' }, locale: 'es' });
 * // 'Título'
 * ```
 */
export function resolveStepText({ field, locale }: ResolveStepTextInput): string {
    // Step 1: try the requested locale (only the three supported keys).
    const supported = ['es', 'en', 'pt'] as const;
    const key = locale as (typeof supported)[number];
    if (supported.includes(key) && field[key]) {
        return field[key];
    }

    // Step 2: project-default fallback.
    if (field.es) {
        return field.es;
    }

    // Step 3: safety net — first non-empty value (should not be reachable
    // when the label is authored against I18nLabelSchema which requires all three).
    const first = Object.values(field).find(
        (v): v is string => typeof v === 'string' && v.length > 0
    );
    return first ?? '';
}
