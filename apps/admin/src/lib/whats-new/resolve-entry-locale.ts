/**
 * resolveEntryLocale — pure locale resolver for What's New entry i18n fields.
 *
 * The server already localises GET-response items before sending them to the
 * client (see SPEC-175 §6.7), so the client normally receives plain strings.
 * This utility exists for **client-side use cases** where the raw `I18nLabel`
 * shape must be resolved locally — for example, resolving `footerLink` labels
 * in the config-driven dashboard or resolving entry content in a component
 * that has the raw entry (e.g. curated data file shared with a storybook).
 *
 * Fallback chain (mirrors `useLocalizedLabel` in `use-localized-label.ts`):
 * 1. `field[locale]` — if the field has the requested locale and it is non-empty.
 * 2. `field['es']`   — project-default locale (Argentina market).
 * 3. `Object.values(field)[0]` — first non-empty string (safety net).
 *
 * Pure function — no React, no DOM, no side effects.
 *
 * @module resolve-entry-locale
 * @see apps/admin/src/hooks/use-localized-label.ts — React hook counterpart
 * @see SPEC-175 §7.7, §12.5
 */

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

/**
 * An i18n object where `es` is the required project-default locale and
 * `en` / `pt` are optional.
 *
 * Mirrors `WhatsNewEntryI18nSchema` from `@repo/schemas` but kept local so
 * this pure helper has zero dependency on the schemas package.
 */
export interface I18nField {
    /** Spanish — required project default locale. */
    readonly es: string;
    /** English — optional. */
    readonly en?: string;
    /** Portuguese — optional. */
    readonly pt?: string;
}

/** Input shape for {@link resolveEntryLocale}. */
export interface ResolveEntryLocaleInput {
    /** The i18n field object to resolve. */
    readonly field: I18nField;
    /**
     * The target locale string (e.g. `'es'`, `'en'`, `'pt'`).
     * Unknown / unsupported values fall back through the chain.
     */
    readonly locale: string;
}

// ---------------------------------------------------------------------------
// Exported function
// ---------------------------------------------------------------------------

/**
 * Resolves an `I18nField` to the best available string for the given locale.
 *
 * Fallback chain:
 * 1. `field[locale]` — if the locale matches `'es'`, `'en'`, or `'pt'` and
 *    the value is non-empty.
 * 2. `field.es`      — project default locale (always required, always present).
 * 3. First non-empty value in `field` — safety net (unreachable in practice
 *    when the caller validates against `WhatsNewEntryI18nSchema`).
 *
 * @param input - `{ field, locale }` pair.
 * @returns The resolved string, never empty when `field.es` is present.
 *
 * @example
 * ```ts
 * resolveEntryLocale({ field: { es: 'Título' }, locale: 'en' });
 * // 'Título'  — falls back to es when en is absent
 *
 * resolveEntryLocale({ field: { es: 'Título', en: 'Title' }, locale: 'en' });
 * // 'Title'
 *
 * resolveEntryLocale({ field: { es: 'Título' }, locale: 'pt' });
 * // 'Título'  — falls back to es when pt is absent
 * ```
 */
export function resolveEntryLocale({ field, locale }: ResolveEntryLocaleInput): string {
    // Step 1: try the requested locale (only the three supported keys).
    const supported = ['es', 'en', 'pt'] as const;
    const key = locale as (typeof supported)[number];
    if (supported.includes(key) && field[key]) {
        return field[key] as string;
    }

    // Step 2: project-default fallback.
    if (field.es) {
        return field.es;
    }

    // Step 3: safety net — first non-empty value.
    const first = Object.values(field).find(
        (v): v is string => typeof v === 'string' && v.length > 0
    );
    return first ?? '';
}
