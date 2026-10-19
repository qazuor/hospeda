import { VerticalEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    describePromoCodeDraft,
    fromMinorUnits,
    type PromoCodeDraft,
    promoCodeRejectionLabel,
    toMinorUnits
} from '../promo-code-draft';

const messages: Record<string, string> = {
    'admin-billing.promoCodes.editor.effects.firstCharge': '{{value}} en el primer cobro',
    'admin-billing.promoCodes.editor.effects.nCharges_one': '{{value}} por {{count}} cobro',
    'admin-billing.promoCodes.editor.effects.nCharges_other': '{{value}} por {{count}} cobros',
    'admin-billing.promoCodes.editor.effects.forever': '{{value}} para siempre',
    'admin-billing.promoCodes.editor.effects.trialExtension_one': '{{count}} día más de prueba',
    'admin-billing.promoCodes.editor.effects.trialExtension_other': '{{count}} días más de prueba',
    'admin-billing.promoCodes.editor.reach.allFuture': 'todas las verticales, también las futuras',
    'admin-billing.promoCodes.editor.reach.selected': 'verticales seleccionadas',
    'admin-billing.promoCodes.editor.verticals.accommodation': 'alojamientos',
    'admin-billing.promoCodes.editor.verticals.gastronomy': 'gastronomía',
    'admin-billing.promoCodes.editor.verticals.experience': 'experiencias',
    'admin-billing.promoCodes.editor.verticals.tourist': 'turismo',
    'admin-billing.promoCodes.editor.verticals.partner': 'partners',
    'admin-billing.promoCodes.editor.uses.quota':
        'hasta {{count}} canjes en total, uno por persona',
    'admin-billing.promoCodes.editor.uses.unlimited': 'sin tope de canjes, uno por persona',
    'admin-billing.promoCodes.editor.validity.now': 'ahora',
    'admin-billing.promoCodes.editor.validity.range': 'desde {{from}} hasta {{until}}',
    'admin-billing.promoCodes.editor.validity.noEnd': 'desde {{from}}, sin fecha de fin'
};
const t = (key: string) => messages[key] ?? key;
const tPlural = (key: string, count: number, params: Record<string, unknown> = {}) => {
    const template = messages[`${key}_${count === 1 ? 'one' : 'other'}`] ?? key;
    return Object.entries({ ...params, count }).reduce(
        (result, [name, value]) => result.replaceAll(`{{${name}}}`, String(value)),
        template
    );
};

const draft = (overrides: Partial<PromoCodeDraft> = {}): PromoCodeDraft => ({
    code: 'PROMO_20',
    effect: {
        kind: 'DISCOUNT',
        discountKind: 'PERCENTAGE',
        value: 20,
        durationKind: 'N_CHARGES',
        durationCharges: 3
    },
    allVerticals: true,
    verticals: null,
    totalQuota: 100,
    validUntil: '2026-12-31',
    stackable: false,
    usableWithAnotherActive: false,
    ...overrides
});

describe('AC:B9b:9 HOS-1591 promo code draft and TEST:B9b:9 (support)', () => {
    it('converts peso inputs with zero, one, or two decimals to integer centavos and back', () => {
        expect(toMinorUnits({ pesos: '0' })).toBe(0);
        expect(toMinorUnits({ pesos: '1.2' })).toBe(120);
        expect(toMinorUnits({ pesos: '14.35' })).toBe(1435);
        expect(fromMinorUnits({ minor: 0 })).toBe('0.00');
        expect(fromMinorUnits({ minor: 120 })).toBe('1.20');
        expect(fromMinorUnits({ minor: 1435 })).toBe('14.35');
    });

    it('rejects a fixed peso input with three decimal places', () => {
        expect(() => toMinorUnits({ pesos: '1.234' })).toThrow(RangeError);
    });

    it('describes percentage durations and fixed first-charge effects', () => {
        expect(describePromoCodeDraft({ draft: draft(), locale: 'es-AR', t, tPlural }).effect).toBe(
            '20% por 3 cobros'
        );
        expect(
            describePromoCodeDraft({
                draft: draft({
                    effect: {
                        kind: 'DISCOUNT',
                        discountKind: 'PERCENTAGE',
                        value: 20,
                        durationKind: 'N_CHARGES',
                        durationCharges: 1
                    }
                }),
                locale: 'es-AR',
                t,
                tPlural
            }).effect
        ).toBe('20% por 1 cobro');
        expect(
            describePromoCodeDraft({
                draft: draft({
                    effect: {
                        kind: 'DISCOUNT',
                        discountKind: 'FIXED',
                        value: 10000,
                        pesos: '100',
                        durationKind: 'FIRST_CHARGE',
                        durationCharges: null
                    }
                }),
                locale: 'es-AR',
                t,
                tPlural
            }).effect
        ).toContain('100');
    });

    it('describes forever discounts and trial extensions', () => {
        expect(
            describePromoCodeDraft({
                draft: draft({
                    effect: {
                        kind: 'DISCOUNT',
                        discountKind: 'PERCENTAGE',
                        value: 20,
                        durationKind: 'FOREVER',
                        durationCharges: null
                    }
                }),
                locale: 'es-AR',
                t,
                tPlural
            }).effect
        ).toBe('20% para siempre');
        expect(
            describePromoCodeDraft({
                draft: draft({ effect: { kind: 'TRIAL_EXTENSION', extensionDays: 30 } }),
                locale: 'es-AR',
                t,
                tPlural
            }).effect
        ).toBe('30 días más de prueba');
        expect(
            describePromoCodeDraft({
                draft: draft({ effect: { kind: 'TRIAL_EXTENSION', extensionDays: 1 } }),
                locale: 'es-AR',
                t,
                tPlural
            }).effect
        ).toBe('1 día más de prueba');
    });

    it('describes all-future or selected verticals and bounded or unlimited uses', () => {
        const all = describePromoCodeDraft({
            draft: draft({ totalQuota: 10 }),
            locale: 'es-AR',
            t,
            tPlural
        });
        expect(all.reach).toBe('todas las verticales, también las futuras');
        expect(all.uses).toBe('hasta 10 canjes en total, uno por persona');
        const selected = describePromoCodeDraft({
            draft: draft({
                allVerticals: false,
                verticals: [VerticalEnum.ACCOMMODATION, VerticalEnum.EXPERIENCE],
                totalQuota: null
            }),
            locale: 'es-AR',
            t,
            tPlural
        });
        expect(selected.reach).toBe('alojamientos, experiencias');
        expect(selected.uses).toBe('sin tope de canjes, uno por persona');
    });

    it('describes bounded and open-ended validity, using now when validFrom is omitted', () => {
        expect(
            describePromoCodeDraft({
                draft: draft({ validFrom: '2026-01-01', validUntil: '2026-12-31' }),
                locale: 'en-US',
                t,
                tPlural
            }).validity
        ).toMatch(/desde Jan 1, 2026 hasta Dec 31, 2026/);
        expect(
            describePromoCodeDraft({
                draft: draft({ validUntil: null }),
                locale: 'es-AR',
                t,
                tPlural
            }).validity
        ).toBe('desde ahora, sin fecha de fin');
    });

    it('maps known rejections and falls back safely for an unknown reason', () => {
        expect(promoCodeRejectionLabel({ reason: 'PROMO_CODE_ALREADY_EXISTS', t })).toBe(
            'admin-billing.promoCodes.editor.rejections.alreadyExists'
        );
        expect(promoCodeRejectionLabel({ reason: 'UNRECOGNIZED_REASON', t })).toBe(
            'admin-billing.promoCodes.editor.rejections.generic'
        );
    });
});
