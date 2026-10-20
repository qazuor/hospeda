import type { TranslationKey } from '@repo/i18n';
import {
    type AdminPromoCodeEffect,
    type AdminPromoCodeRejectionSchema,
    VerticalEnum
} from '@repo/schemas';
import type { z } from 'zod';

export type PromoCodeDraft = {
    readonly code: string;
    readonly effect:
        | (Extract<AdminPromoCodeEffect, { kind: 'DISCOUNT' }> & { readonly pesos?: string })
        | Extract<AdminPromoCodeEffect, { kind: 'TRIAL_EXTENSION' }>;
    readonly allVerticals: boolean;
    readonly verticals: VerticalEnum[] | null;
    readonly totalQuota: number | null;
    readonly validFrom?: string | Date | null;
    readonly validUntil: string | Date | null;
    readonly stackable: boolean;
    readonly usableWithAnotherActive: boolean;
};

export type PromoCodeSummary = {
    readonly effect: string;
    readonly reach: string;
    readonly uses: string;
    readonly validity: string;
};

export type PromoCodeTranslator = (key: TranslationKey) => string;
export type PromoCodePluralTranslator = (
    key: TranslationKey,
    count: number,
    params?: Record<string, unknown>
) => string;

/** Converts a peso amount with at most two decimal places to integer centavos. */
export function toMinorUnits({ pesos }: { readonly pesos: string | number }): number {
    const raw = String(pesos).trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
        throw new RangeError('Amount must be non-negative pesos with at most two decimals');
    }
    const [whole = '0', fraction = ''] = raw.split('.');
    const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0') || '0');
    if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('Amount is too large');
    return Number(minor);
}

/** Converts integer centavos to a peso amount with exactly two decimal places. */
export function fromMinorUnits({ minor }: { readonly minor: number }): string {
    if (!Number.isSafeInteger(minor)) throw new RangeError('Minor amount must be a safe integer');
    const sign = minor < 0 ? '-' : '';
    const absolute = BigInt(Math.abs(minor));
    return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}

/** Labels supplied by the API; the admin panel never recalculates availability. */
export const PROMO_CODE_AVAILABILITY_KEY: Record<
    'OPEN' | 'CLOSED' | 'NOT_YET_VALID' | 'EXPIRED' | 'EXHAUSTED',
    string
> = {
    OPEN: 'admin-billing.promoCodes.editor.availability.open',
    CLOSED: 'admin-billing.promoCodes.editor.availability.closed',
    NOT_YET_VALID: 'admin-billing.promoCodes.editor.availability.notYetValid',
    EXPIRED: 'admin-billing.promoCodes.editor.availability.expired',
    EXHAUSTED: 'admin-billing.promoCodes.editor.availability.exhausted'
};

/** Localized copy keys for the five action 21 service rejections. */
export const PROMO_CODE_REJECTION_KEY: Record<
    z.infer<typeof AdminPromoCodeRejectionSchema>,
    string
> = {
    ADMINISTRATIVE_ACTION_FORBIDDEN: 'admin-billing.promoCodes.editor.rejections.forbidden',
    PROMO_CODE_NOT_FOUND: 'admin-billing.promoCodes.editor.rejections.notFound',
    PROMO_CODE_ALREADY_EXISTS: 'admin-billing.promoCodes.editor.rejections.alreadyExists',
    PROMO_CODE_ALREADY_CLOSED: 'admin-billing.promoCodes.editor.rejections.alreadyClosed',
    INVALID_PROMO_CODE_INPUT: 'admin-billing.promoCodes.editor.rejections.invalidInput'
};

const verticalLabels: Record<VerticalEnum, string> = {
    [VerticalEnum.ACCOMMODATION]: 'admin-billing.promoCodes.editor.verticals.accommodation',
    [VerticalEnum.GASTRONOMY]: 'admin-billing.promoCodes.editor.verticals.gastronomy',
    [VerticalEnum.EXPERIENCE]: 'admin-billing.promoCodes.editor.verticals.experience',
    [VerticalEnum.TOURIST]: 'admin-billing.promoCodes.editor.verticals.tourist',
    [VerticalEnum.PARTNER]: 'admin-billing.promoCodes.editor.verticals.partner'
};

function fill(template: string, values: Record<string, string | number>): string {
    return Object.entries(values).reduce(
        (result, [key, value]) => result.replaceAll(`{{${key}}}`, String(value)),
        template
    );
}

function dateLabel(value: string | Date, locale: string): string {
    const date =
        value instanceof Date ? value : new Date(value.length === 10 ? `${value}T12:00:00` : value);
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}

/** Describes the four consequences of a draft before the create request is sent. */
export function describePromoCodeDraft({
    draft,
    locale,
    t,
    tPlural
}: {
    readonly draft: PromoCodeDraft;
    readonly locale: string;
    readonly t: PromoCodeTranslator;
    readonly tPlural: PromoCodePluralTranslator;
}): PromoCodeSummary {
    const { effect } = draft;
    let effectText: string;
    switch (effect.kind) {
        case 'DISCOUNT': {
            const value =
                effect.discountKind === 'FIXED'
                    ? new Intl.NumberFormat(locale, { style: 'currency', currency: 'ARS' }).format(
                          toMinorUnits({ pesos: effect.pesos ?? String(effect.value) }) / 100
                      )
                    : `${effect.value}%`;
            switch (effect.durationKind) {
                case 'FIRST_CHARGE':
                    effectText = fill(t('admin-billing.promoCodes.editor.effects.firstCharge'), {
                        value
                    });
                    break;
                case 'N_CHARGES':
                    effectText = tPlural(
                        'admin-billing.promoCodes.editor.effects.nCharges' as TranslationKey,
                        effect.durationCharges ?? 0,
                        { value }
                    );
                    break;
                case 'FOREVER':
                    effectText = fill(t('admin-billing.promoCodes.editor.effects.forever'), {
                        value
                    });
                    break;
            }
            break;
        }
        case 'TRIAL_EXTENSION':
            effectText = tPlural(
                'admin-billing.promoCodes.editor.effects.trialExtension' as TranslationKey,
                effect.extensionDays
            );
            break;
    }

    const reach = draft.allVerticals
        ? t('admin-billing.promoCodes.editor.reach.allFuture')
        : (draft.verticals ?? [])
              .map((vertical) => t(verticalLabels[vertical] as TranslationKey))
              .join(', ');
    const uses =
        draft.totalQuota === null
            ? t('admin-billing.promoCodes.editor.uses.unlimited')
            : fill(t('admin-billing.promoCodes.editor.uses.quota'), { count: draft.totalQuota });
    const from = draft.validFrom
        ? dateLabel(draft.validFrom, locale)
        : t('admin-billing.promoCodes.editor.validity.now');
    const validity = draft.validUntil
        ? fill(t('admin-billing.promoCodes.editor.validity.range'), {
              from,
              until: dateLabel(draft.validUntil, locale)
          })
        : fill(t('admin-billing.promoCodes.editor.validity.noEnd'), { from });
    return { effect: effectText, reach, uses, validity };
}

/** Maps a known API rejection to its localized key and safely handles unknown reasons. */
export function promoCodeRejectionLabel({
    reason,
    t
}: {
    readonly reason: unknown;
    readonly t: PromoCodeTranslator;
}): string {
    if (typeof reason === 'string' && Object.hasOwn(PROMO_CODE_REJECTION_KEY, reason)) {
        const key = PROMO_CODE_REJECTION_KEY[reason as keyof typeof PROMO_CODE_REJECTION_KEY];
        return t(key as TranslationKey);
    }
    return t('admin-billing.promoCodes.editor.rejections.generic');
}
