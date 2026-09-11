import { isMissingTranslation } from '../missing-translation';
import { pluralize } from '../pluralization';

/**
 * Resolves a zodError or validationError key to a translated message.
 *
 * Mapping rules:
 * - `'zodError.amenity.name.min'` maps to `t('validation.amenity.name.min', params)`
 * - `'validationError.field.tooSmall'` maps to `t('validation.field.tooSmall', params)`
 * - Any other key is passed to `t` as-is
 *
 * When `params.count` is a number, resolution goes through {@link pluralize}
 * instead of a plain `t()` call, trying `<key>_one`/`<key>_other` before
 * falling back to the base key (HOS-898). Without this, a validation key
 * that was split into a CLDR `_one`/`_other` pair (e.g. a "cannot exceed N
 * minutes" schema `.max()` message) would resolve to nothing through this
 * function — the base key it used to be no longer exists — and the caller
 * would render the raw dotted key to the user. Callers that never populate
 * `count` (the overwhelming majority of `zodError.*`/`validationError.*`
 * keys, none of which are plural-shaped) are unaffected: this branch is
 * simply never taken for them.
 *
 * Fallback: if the translation function reports the key as absent (see
 * `isMissingTranslation` — the marker in dev, the raw key echo in production),
 * the original `key` is returned unchanged so the caller always receives a
 * non-empty, meaningful value.
 *
 * @param input - Options object
 * @param input.key - The error key to resolve (e.g. `'zodError.amenity.name.min'`)
 * @param input.t - Translation function from `useTranslations()`
 * @param input.params - Optional interpolation parameters forwarded to `t`. A
 *   numeric `count` routes resolution through `pluralize()`.
 * @returns Translated message string, or the original key when no translation exists
 *
 * @example
 * ```ts
 * const { t } = useTranslations();
 * const tAny = t as (key: string, params?: Record<string, unknown>) => string;
 *
 * resolveValidationMessage({
 *   key: 'zodError.amenity.name.min',
 *   t: tAny,
 *   params: { min: 2 }
 * });
 * // Returns: "El nombre debe tener al menos 2 caracteres"
 *
 * resolveValidationMessage({
 *   key: 'zodError.experience.durationMinutes.max',
 *   t: tAny,
 *   params: { max: 5, count: 5 }
 * });
 * // Returns the `_other` sibling: "La duración no puede superar los 5 minutos"
 *
 * resolveValidationMessage({
 *   key: 'validationError.field.tooSmall',
 *   t: tAny,
 * });
 * // Returns: translated value for "validation.field.tooSmall"
 *
 * resolveValidationMessage({
 *   key: 'some.unknown.key',
 *   t: tAny,
 * });
 * // Returns: translated value for "some.unknown.key", or the key itself if missing
 * ```
 */
export function resolveValidationMessage({
    key,
    t,
    params
}: {
    readonly key: string;
    readonly t: (key: string, params?: Record<string, unknown>) => string;
    readonly params?: Record<string, unknown>;
}): string {
    if (!key) {
        return '';
    }

    let i18nKey: string;

    if (key.startsWith('zodError.')) {
        i18nKey = `validation.${key.slice('zodError.'.length)}`;
    } else if (key.startsWith('validationError.')) {
        i18nKey = `validation.${key.slice('validationError.'.length)}`;
    } else {
        i18nKey = key;
    }

    const count = params?.count;
    const translated =
        typeof count === 'number'
            ? pluralize({ t, key: i18nKey, count, params })
            : t(i18nKey, params);

    // Absence is decided by the canonical predicate: a development build reports
    // it with the `[MISSING:` marker, a production build echoes the raw key back.
    if (isMissingTranslation({ key: i18nKey, value: translated })) {
        return key;
    }

    return translated;
}
