import type { TranslationKey } from '@repo/i18n';

/** Translator as returned by `useTranslations` (the caller owns the hook). */
type Translate = (key: TranslationKey, params?: Record<string, unknown>) => string;

/**
 * Builds the admin label that tells two versions of the same plan apart
 * (HOS-1616 O-3).
 *
 * Every version of a plan shares its `name`, so the plain name makes the source
 * and the target of an increase, and every row of the retired list, look
 * identical. The server derives a 1-based ordinal per plan (`versionNumber`),
 * and this label appends it to the name.
 *
 * @param params.t - Translator, usually the one returned by `useTranslations`.
 * @param params.name - Plan name shared by every version of that plan.
 * @param params.versionNumber - 1-based ordinal of the version inside its plan.
 * @returns The localized `{name} · versión {number}` label.
 *
 * @example
 * ```ts
 * const label = planVersionLabel({ t, name: 'Succession plan', versionNumber: 2 });
 * // "Succession plan · versión 2"
 * ```
 */
export function planVersionLabel(params: {
    t: Translate;
    name: string;
    versionNumber: number;
}): string {
    return params.t('admin-pages.planMigration.versionLabel', {
        name: params.name,
        number: params.versionNumber
    });
}
