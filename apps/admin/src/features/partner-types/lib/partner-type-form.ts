/**
 * @file partner-type-form.ts
 * @description Pure helpers for the partner type catalog screen (HOS-2336):
 * translation keys, row → dialog values, and dialog values → API payloads.
 *
 * Kept out of the components so the payload rules are testable on their own:
 * the slug travels on create only (slugs are immutable, AC-3.3), `active` maps
 * to `lifecycleState`, and the weight arrives as text from the input.
 */

import type { TranslationKey } from '@repo/i18n';
import { type I18nText, LifecycleStatusEnum, type PartnerTypeAdminListItem } from '@repo/schemas';

/** Root of the screen's copy. */
const ROOT = 'admin-pages.partnerTypes';

/** Default ordering weight, matching the schema default. */
export const DEFAULT_PARTNER_TYPE_WEIGHT = 50;

/** Values the dialog edits. `displayWeight` stays text until submit. */
export interface PartnerTypeFormValues {
    readonly slug: string;
    readonly nameI18n: I18nText;
    readonly displayWeight: string;
    readonly active: boolean;
}

/**
 * Returns the full translation key for a path under the screen's copy.
 *
 * The path is a runtime value, so the literal-key type of `t()` cannot see it;
 * the cast lives here once and the key tree is checked by the i18n guards.
 *
 * @param input - Object with the path below `admin-pages.partnerTypes`.
 */
export function partnerTypesKey({ path }: { readonly path: string }): TranslationKey {
    return `${ROOT}.${path}` as TranslationKey;
}

/**
 * Builds the dialog values for a new row or an existing one.
 *
 * @param input - The row being edited, or nothing when creating.
 */
export function toPartnerTypeFormValues({
    row
}: {
    readonly row?: PartnerTypeAdminListItem;
}): PartnerTypeFormValues {
    const empty: I18nText = { es: '', en: '', pt: '' };
    if (!row) {
        return {
            slug: '',
            nameI18n: empty,
            displayWeight: String(DEFAULT_PARTNER_TYPE_WEIGHT),
            active: true
        };
    }
    return {
        slug: row.slug,
        nameI18n: { ...empty, ...row.nameI18n },
        displayWeight: String(row.displayWeight),
        active: row.lifecycleState === LifecycleStatusEnum.ACTIVE
    };
}

/**
 * Builds the request body, validated afterwards against the create or the
 * strict update schema. The slug travels on create only; a blank weight
 * becomes `NaN` so the schema rejects it with its own message instead of this
 * layer silently picking a default.
 *
 * @param input - Dialog mode and values.
 */
export function buildPartnerTypePayload({
    mode,
    values
}: {
    readonly mode: 'create' | 'edit';
    readonly values: PartnerTypeFormValues;
}): Record<string, unknown> {
    const nameI18n: Record<string, string> = {
        es: values.nameI18n.es?.trim() ?? '',
        ...(values.nameI18n.en?.trim() ? { en: values.nameI18n.en.trim() } : {}),
        ...(values.nameI18n.pt?.trim() ? { pt: values.nameI18n.pt.trim() } : {})
    };
    const common = {
        nameI18n,
        displayWeight:
            values.displayWeight.trim() === '' ? Number.NaN : Number(values.displayWeight),
        lifecycleState: values.active ? LifecycleStatusEnum.ACTIVE : LifecycleStatusEnum.INACTIVE
    };
    return mode === 'create' ? { slug: values.slug.trim(), ...common } : common;
}
