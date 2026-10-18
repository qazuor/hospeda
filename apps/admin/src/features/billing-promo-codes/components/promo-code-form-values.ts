import type { VerticalEnum } from '@repo/schemas';
import { toMinorUnits } from '../promo-code-draft';

export type PromoCodeFormValues = {
    code: string;
    kind: 'DISCOUNT' | 'TRIAL_EXTENSION';
    discountKind: 'PERCENTAGE' | 'FIXED';
    value: string;
    durationKind: 'FIRST_CHARGE' | 'N_CHARGES' | 'FOREVER';
    durationCharges: string;
    extensionDays: string;
    allVerticals: boolean;
    verticals: VerticalEnum[];
    totalQuota: string;
    validFrom: string;
    validUntil: string;
    stackable: boolean;
    usableWithAnotherActive: boolean;
};

export const initialPromoCodeFormValues: PromoCodeFormValues = {
    code: '',
    kind: 'DISCOUNT',
    discountKind: 'PERCENTAGE',
    value: '',
    durationKind: 'N_CHARGES',
    durationCharges: '3',
    extensionDays: '30',
    allVerticals: true,
    verticals: [],
    totalQuota: '',
    validFrom: '',
    validUntil: '',
    stackable: false,
    usableWithAnotherActive: false
};

/** Builds the request shape from the fields shown in the create form. */
export function makePromoCodeCreateRequest(value: PromoCodeFormValues) {
    const effect =
        value.kind === 'TRIAL_EXTENSION'
            ? { kind: 'TRIAL_EXTENSION' as const, extensionDays: Number(value.extensionDays) }
            : {
                  kind: 'DISCOUNT' as const,
                  discountKind: value.discountKind,
                  value:
                      value.discountKind === 'FIXED'
                          ? toMinorUnits({ pesos: value.value })
                          : Number(value.value),
                  durationKind: value.durationKind,
                  durationCharges:
                      value.durationKind === 'N_CHARGES' ? Number(value.durationCharges) : null
              };
    return {
        code: value.code,
        effect,
        allVerticals: value.allVerticals,
        verticals: value.allVerticals ? null : value.verticals,
        totalQuota: value.totalQuota === '' ? null : Number(value.totalQuota),
        ...(value.validFrom ? { validFrom: value.validFrom } : {}),
        validUntil: value.validUntil || null,
        stackable: value.stackable,
        usableWithAnotherActive: value.usableWithAnotherActive
    };
}
