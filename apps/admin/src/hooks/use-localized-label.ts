/**
 * useLocalizedLabel — resolves an {@link I18nLabel} to the correct locale string.
 *
 * Reads the active locale from `useTranslations().locale` (the same pattern used
 * elsewhere in the admin app, e.g. `PurchasedAddonDetailsDialog`). Falls back
 * through: `currentLocale` → `'es'` (project default per CLAUDE.md) → first
 * available key in the label object.
 *
 * API used: `useTranslations()` from `@/hooks/use-translations` (which re-exports
 * from `@repo/i18n`) returns `{ t, tPlural, locale }`. The `locale` field is the
 * active locale string (defaults to `'es'`).
 *
 * @module use-localized-label
 * @see packages/i18n/src/hooks/use-translations.ts — locale source
 * @see SPEC-154 T-021 (consumed by label rendering in IA components)
 */

import type { I18nLabel } from '@/config/ia/schema';
import { useTranslations } from '@/hooks/use-translations';

// ---------------------------------------------------------------------------
// Exported hook
// ---------------------------------------------------------------------------

/**
 * Resolves an {@link I18nLabel} to a display string for the current locale.
 *
 * Fallback chain:
 * 1. `label[currentLocale]`  — if the locale is one of the three supported ones.
 * 2. `label['es']`           — project default (Argentina market).
 * 3. `label[firstKey]`       — first value in the label object (safety net).
 *
 * The I18nLabel schema guarantees all three locales (es/en/pt) are present and
 * non-empty, so in practice the fallback to step 3 is unreachable in valid configs.
 *
 * @param label - The tri-locale label from the validated IA config.
 * @returns The display string in the current locale.
 *
 * @example
 * ```ts
 * const label = useLocalizedLabel({ es: 'Catálogo', en: 'Catalog', pt: 'Catálogo' });
 * // Returns 'Catálogo' when locale is 'es', 'Catalog' when locale is 'en'.
 * ```
 */
export function useLocalizedLabel(label: I18nLabel): string {
    const { locale } = useTranslations();

    // Try the current locale first.
    const localeKey = locale as keyof I18nLabel;
    if (localeKey in label && label[localeKey]) {
        return label[localeKey];
    }

    // Fall back to 'es' (project default).
    if (label.es) {
        return label.es;
    }

    // Safety net — first non-empty value available.
    const first = Object.values(label).find((v) => Boolean(v));
    return first ?? '';
}
