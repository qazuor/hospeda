/**
 * Resolves a zodError or validationError key to a translated message.
 *
 * Mapping rules:
 * - `'zodError.amenity.name.min'` maps to `t('validation.amenity.name.min', params)`
 * - `'validationError.field.tooSmall'` maps to `t('validation.field.tooSmall', params)`
 * - Any other key is passed to `t` as-is
 *
 * Fallback: if the translation function returns a string starting with
 * `'[MISSING:'`, the original `key` is returned unchanged so the caller
 * always receives a non-empty, meaningful value.
 *
 * @param input - Options object
 * @param input.key - The error key to resolve (e.g. `'zodError.amenity.name.min'`)
 * @param input.t - Translation function from `useTranslations()`
 * @param input.params - Optional interpolation parameters forwarded to `t`
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

    const translated = t(i18nKey, params);

    if (translated.startsWith('[MISSING:')) {
        return key;
    }

    return translated;
}
