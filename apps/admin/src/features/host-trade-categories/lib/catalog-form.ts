/**
 * @file catalog-form.ts
 * @description Pure helpers that turn catalog rows into dialog values and
 * dialog values into API payloads (HOS-919 T-043, T-044).
 *
 * Kept out of the components so the payload rules are testable on their own:
 * the slug travels on create only (slugs are immutable, D8), `active` maps to
 * `lifecycleState`, and the weight arrives as text from the input.
 */

import {
    type HostTradeCategoryAdmin,
    type HostTradeCategoryGroupAdmin,
    type I18nText,
    LifecycleStatusEnum
} from '@repo/schemas';
import type { CatalogBasicValues } from '../components/CatalogBasicFields';

/** Default ordering weight, matching the schema default. */
export const DEFAULT_DISPLAY_WEIGHT = 50;

/** The empty name every dialog starts from. */
const EMPTY_NAME: I18nText = { es: '', en: '', pt: '' };

/**
 * Builds the shared dialog values for a new row or an existing one.
 *
 * @param input - The row being edited, or nothing when creating.
 */
export function toBasicValues({
    row
}: {
    readonly row?: HostTradeCategoryGroupAdmin | HostTradeCategoryAdmin;
}): CatalogBasicValues {
    if (!row) {
        return {
            slug: '',
            nameI18n: EMPTY_NAME,
            displayWeight: String(DEFAULT_DISPLAY_WEIGHT),
            active: true
        };
    }
    return {
        slug: row.slug,
        nameI18n: { ...EMPTY_NAME, ...row.nameI18n },
        displayWeight: String(row.displayWeight),
        active: row.lifecycleState === LifecycleStatusEnum.ACTIVE
    };
}

/**
 * Converts the weight text into the number the schema validates.
 *
 * A blank or non-numeric text becomes `NaN` on purpose: the schema rejects it
 * with its own message, instead of this layer silently picking a default.
 *
 * @param input - Object with the raw input text.
 */
export function parseDisplayWeight({ raw }: { readonly raw: string }): number {
    return raw.trim() === '' ? Number.NaN : Number(raw);
}

/**
 * Maps the active switch to the API lifecycle value.
 *
 * @param input - Object with the switch state.
 */
export function toLifecycleState({ active }: { readonly active: boolean }): LifecycleStatusEnum {
    return active ? LifecycleStatusEnum.ACTIVE : LifecycleStatusEnum.INACTIVE;
}

/**
 * Builds the group body: slug on create, never on update.
 *
 * @param input - Dialog mode and values.
 */
export function buildGroupPayload({
    mode,
    values
}: {
    readonly mode: 'create' | 'edit';
    readonly values: CatalogBasicValues;
}): Record<string, unknown> {
    const common = {
        nameI18n: values.nameI18n,
        displayWeight: parseDisplayWeight({ raw: values.displayWeight }),
        lifecycleState: toLifecycleState({ active: values.active })
    };
    return mode === 'create' ? { slug: values.slug.trim(), ...common } : common;
}
