/**
 * HOS-2589 email templates: the weekly VIP promotions digest (§7.7, AC-14) and
 * the «Solo VIP» pause notice (D-8, AC-36).
 *
 * @module test/templates/vip-promotions.templates.test
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
    buildVipPromotionsPausedSubject,
    VipPromotionsPaused
} from '../../src/templates/promotions/vip-promotions-paused';
import {
    buildVipPromotionsDigestSubject,
    VipPromotionsWeeklyDigest,
    type VipPromotionsWeeklyDigestProps
} from '../../src/templates/promotions/vip-promotions-weekly-digest';

const digest: VipPromotionsWeeklyDigestProps = {
    recipientName: 'Ana',
    locale: 'es',
    promotions: [
        {
            title: 'Fin de semana largo',
            benefit: '20% de descuento',
            placeName: 'Cabañas del Río',
            placeUrl: 'https://hospeda.test/es/alojamientos/cabanas-del-rio/',
            vipOnly: false,
            startsLabel: null
        },
        {
            title: 'Cena para dos',
            benefit: '$ 5.000 de descuento',
            placeName: 'Parrilla del Puerto',
            placeUrl: 'https://hospeda.test/es/comer-y-salir/parrilla-del-puerto/',
            vipOnly: true,
            startsLabel: 'Desde el 1 de diciembre'
        }
    ],
    moreCount: 4,
    promotionsUrl: 'https://hospeda.test/es/promociones/',
    preferencesUrl: 'https://hospeda.test/es/mi-cuenta/preferencias/'
};

describe('VipPromotionsWeeklyDigest', () => {
    it('lists every promotion with its benefit, place link and the VIP mark', () => {
        const html = renderToStaticMarkup(VipPromotionsWeeklyDigest(digest));

        expect(html).toContain('Fin de semana largo');
        expect(html).toContain('20% de descuento');
        expect(html).toContain(digest.promotions[0]?.placeUrl);
        expect(html).toContain('Cena para dos · VIP');
        expect(html).toContain('Desde el 1 de diciembre');
    });

    it('says how many more there are and links to the promotions page', () => {
        const html = renderToStaticMarkup(VipPromotionsWeeklyDigest(digest));
        expect(html).toContain('y 4 promociones más');
        expect(html).toContain(digest.promotionsUrl);
    });

    it('carries the opt-out link', () => {
        const html = renderToStaticMarkup(VipPromotionsWeeklyDigest(digest));
        expect(html).toContain(digest.preferencesUrl);
    });

    it.each([
        ['en', 'See all promotions'],
        ['pt', 'Ver todas as promoções']
    ] as const)('renders in %s', (locale, cta) => {
        expect(renderToStaticMarkup(VipPromotionsWeeklyDigest({ ...digest, locale }))).toContain(
            cta
        );
    });

    it('builds a pluralised subject per locale', () => {
        expect(buildVipPromotionsDigestSubject({ locale: 'es', total: 1 }).subject).toBe(
            '1 promoción nueva esta semana'
        );
        expect(buildVipPromotionsDigestSubject({ locale: 'en', total: 3 }).subject).toBe(
            '3 new promotions this week'
        );
    });
});

describe('VipPromotionsPaused', () => {
    const props = {
        recipientName: 'Juan',
        locale: 'es' as const,
        promotionTitles: ['Fin de semana largo', 'Cena para dos'],
        promotionsUrl: 'https://hospeda.test/es/mi-cuenta/promociones/'
    };

    it('names each paused promotion, the reason and the way back', () => {
        const html = renderToStaticMarkup(VipPromotionsPaused(props));
        expect(html).toContain('Fin de semana largo');
        expect(html).toContain('Cena para dos');
        expect(html).toContain('ya no incluye la opción «Solo VIP»');
        expect(html).toContain('«Para todos»');
        expect(html).toContain(props.promotionsUrl);
    });

    it('builds a pluralised subject per locale', () => {
        expect(buildVipPromotionsPausedSubject({ locale: 'es', count: 2 }).subject).toBe(
            'Pausamos 2 promociones «Solo VIP»'
        );
        expect(buildVipPromotionsPausedSubject({ locale: 'pt', count: 1 }).subject).toBe(
            'Pausamos 1 promoção «Só VIP»'
        );
    });
});
