/**
 * @file promotion-form-state.ts
 * @description Pure state helpers of the owner-promotion form (SPEC-205 T-304,
 * split out of `PromotionForm.client.tsx` for HOS-2505): the field model, its
 * initial values, the request payload and the explicit required-field checks.
 * No React and no network here, so every rule is testable on its own.
 */

import {
    ACCOMMODATION_PROMOTION_DISCOUNT_TYPES,
    OwnerPromotionDiscountTypeEnum
} from '@repo/schemas';
import type { OwnerPromotionData } from '@/lib/api/types';

/** The form's editable fields, as the inputs hold them (strings, one boolean). */
export interface PromotionFieldValues {
    readonly title: string;
    readonly description: string;
    readonly discountType: string;
    readonly discountValue: string;
    readonly validFrom: string;
    readonly validUntil: string;
    readonly minNights: string;
    readonly maxRedemptions: string;
    readonly accommodationId: string;
    readonly vipOnly: boolean;
}

/** Field name to translated error. */
export type PromotionFieldErrors = Partial<Record<keyof PromotionFieldValues, string>>;

/**
 * HOS-2270: the accommodation form offers ITS benefit types only;
 * `special_offer` is a venue benefit and must never appear here (AC-21).
 */
export const PROMOTION_DISCOUNT_TYPE_VALUES = ACCOMMODATION_PROMOTION_DISCOUNT_TYPES;

/**
 * Converts a Date or ISO string to `YYYY-MM-DD` for `<input type="date">`.
 *
 * @param value - The date, or nothing.
 * @returns The input value, or `''` for a missing or invalid date.
 */
export function toDateInputValue(value: string | Date | null | undefined): string {
    if (!value) return '';
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

/**
 * Builds the initial fields from a promotion (edit) or empty (create).
 *
 * @param input - Options object.
 * @param input.data - The promotion being edited, if any.
 * @returns The field values.
 */
export function buildInitialPromotionFields({
    data
}: {
    readonly data?: OwnerPromotionData;
}): PromotionFieldValues {
    return {
        title: data?.title ?? '',
        description: data?.description ?? '',
        discountType: data?.discountType ?? '',
        discountValue: data?.discountValue == null ? '' : String(data.discountValue),
        validFrom: toDateInputValue(data?.validFrom),
        validUntil: toDateInputValue(data?.validUntil),
        minNights: data?.minNights == null ? '' : String(data.minNights),
        maxRedemptions: data?.maxRedemptions == null ? '' : String(data.maxRedemptions),
        accommodationId: data?.accommodationId ?? '',
        vipOnly: data?.touristAudience === 'vip'
    };
}

/**
 * Whether two field sets hold the same values (the form is pristine).
 *
 * @param input - Options object.
 * @param input.a - One field set.
 * @param input.b - The other.
 * @returns `true` when every field matches.
 */
export function samePromotionFields({
    a,
    b
}: {
    readonly a: PromotionFieldValues;
    readonly b: PromotionFieldValues;
}): boolean {
    return (Object.keys(a) as (keyof PromotionFieldValues)[]).every((key) => a[key] === b[key]);
}

/**
 * Builds the request payload: numbers coerced, empty optionals dropped.
 *
 * @param input - Options object.
 * @param input.fields - The current field values.
 * @param input.baseline - The values the form opened with (edit mode).
 * @returns The payload the Zod schema validates.
 *
 * The audience (HOS-2589 AC-2) is always explicit: «Para todos» stores `plus` even
 * when the stored value was `vip`. The one omission is an UNCHANGED «Solo VIP» on
 * edit, so an owner whose plan lost `vip_only_promotions` can still fix the text of
 * a paused promotion without re-asserting the audience the API would refuse (D-8).
 */
export function buildPromotionPayload({
    fields,
    baseline
}: {
    readonly fields: PromotionFieldValues;
    readonly baseline?: PromotionFieldValues;
}): Record<string, unknown> {
    const keepsVip = fields.vipOnly && baseline?.vipOnly === true;
    const numberOrUndefined = (value: string): number | undefined =>
        value === '' ? undefined : Number(value);
    return {
        title: fields.title,
        description: fields.description === '' ? undefined : fields.description,
        discountType: fields.discountType === '' ? undefined : fields.discountType,
        discountValue: numberOrUndefined(fields.discountValue),
        validFrom: fields.validFrom === '' ? undefined : fields.validFrom,
        validUntil: fields.validUntil === '' ? undefined : fields.validUntil,
        minNights: numberOrUndefined(fields.minNights),
        maxRedemptions: numberOrUndefined(fields.maxRedemptions),
        accommodationId: fields.accommodationId === '' ? undefined : fields.accommodationId,
        touristAudience: keepsVip ? undefined : fields.vipOnly ? 'vip' : 'plus'
    };
}

/** Translator signature the form uses (`t(key, fallback)`). */
type Translate = (key: string, fallback?: string) => string;

/**
 * The explicit required-field checks (the Zod schemas used afterwards are
 * partial), then the percentage cap the base schema does not enforce.
 *
 * @param input - Options object.
 * @param input.fields - The current field values.
 * @param input.t - Translator.
 * @returns The field errors; empty when the fields pass.
 */
export function validatePromotionFields({
    fields,
    t
}: {
    readonly fields: PromotionFieldValues;
    readonly t: Translate;
}): PromotionFieldErrors {
    const errors: { -readonly [K in keyof PromotionFieldValues]?: string } = {};
    if (!fields.title.trim()) {
        errors.title = t('host.promotions.errors.titleRequired', 'El título es requerido.');
    }
    if (!fields.discountType) {
        errors.discountType = t(
            'host.promotions.errors.discountTypeRequired',
            'El tipo de descuento es requerido.'
        );
    }
    if (fields.discountValue === '') {
        errors.discountValue = t(
            'host.promotions.errors.discountValueRequired',
            'El valor del descuento es requerido.'
        );
    }
    if (!fields.validFrom) {
        errors.validFrom = t(
            'host.promotions.errors.validFromRequired',
            'La fecha de inicio es requerida.'
        );
    }
    if (Object.keys(errors).length > 0) return errors;

    if (
        fields.discountType === OwnerPromotionDiscountTypeEnum.PERCENTAGE &&
        Number(fields.discountValue) > 100
    ) {
        return {
            discountValue: t(
                'host.promotions.errors.discountValueMaxPercentage',
                'El porcentaje no puede superar 100.'
            )
        };
    }
    return {};
}
