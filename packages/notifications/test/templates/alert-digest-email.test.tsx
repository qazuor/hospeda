/**
 * AlertDigestEmail Template Test Suite (SPEC-286 T-009)
 *
 * Covers the daily "alerts & offers" digest email template:
 * - Renders without throwing for price-drop-only, promo-offer-only, and
 *   empty payloads.
 * - Includes accommodation names, promotion titles, and CTA links.
 *
 * @module test/templates/alert-digest-email.test
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
    AlertDigestEmail,
    type AlertDigestEmailProps
} from '../../src/templates/alerts/AlertDigestEmail';
import type { PriceDropMatch, PromoOfferMatch } from '../../src/types/alert.types';

function makePriceDropMatch(overrides?: Partial<PriceDropMatch>): PriceDropMatch {
    return {
        alertId: 'alert-1',
        userId: 'user-1',
        accommodationId: 'accommodation-1',
        accommodationSlug: 'cabana-del-rio',
        accommodationName: 'Cabaña del Río',
        basePriceSnapshot: 500000,
        currentPrice: 425000,
        dropPercent: 15,
        currency: 'ARS',
        ...overrides
    };
}

function makePromoOfferMatch(overrides?: Partial<PromoOfferMatch>): PromoOfferMatch {
    return {
        promotionId: 'promo-1',
        accommodationId: 'accommodation-2',
        accommodationName: 'Posada del Litoral',
        accommodationSlug: 'posada-del-litoral',
        promotionTitle: '2x1 fin de semana largo',
        discountType: 'percentage',
        discountValue: 20,
        validUntil: null,
        ...overrides
    };
}

function makePayload(overrides?: Partial<AlertDigestEmailProps>): AlertDigestEmailProps {
    return {
        userId: 'user-1',
        userEmail: 'user@example.com',
        locale: 'es',
        priceDrop: [],
        promoOffers: [],
        ...overrides
    };
}

describe('AlertDigestEmail', () => {
    describe('when priceDrop has items and promoOffers is empty', () => {
        const props = makePayload({ priceDrop: [makePriceDropMatch()] });

        it('should render without throwing', () => {
            // Arrange & Act
            const render = () => renderToStaticMarkup(AlertDigestEmail(props));

            // Assert
            expect(render).not.toThrow();
        });

        it('should include the accommodation name and drop percentage', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AlertDigestEmail(props));

            // Assert
            expect(html).toContain('Cabaña del Río');
            expect(html).toContain('15%');
        });

        it('should include a CTA link built from the accommodation slug', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AlertDigestEmail(props));

            // Assert
            expect(html).toContain('/alojamientos/cabana-del-rio');
        });

        it('should not render the promo-offer section', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AlertDigestEmail(props));

            // Assert
            expect(html).not.toContain('Ofertas activas para vos');
        });
    });

    describe('when promoOffers has items and priceDrop is empty', () => {
        const props = makePayload({ promoOffers: [makePromoOfferMatch()] });

        it('should render without throwing', () => {
            // Arrange & Act
            const render = () => renderToStaticMarkup(AlertDigestEmail(props));

            // Assert
            expect(render).not.toThrow();
        });

        it('should include the accommodation name and promotion title', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AlertDigestEmail(props));

            // Assert
            expect(html).toContain('Posada del Litoral');
            expect(html).toContain('2x1 fin de semana largo');
        });

        it('should include the discount description', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AlertDigestEmail(props));

            // Assert
            expect(html).toContain('20% de descuento');
        });

        it('should show "Sin vencimiento" when validUntil is null', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AlertDigestEmail(props));

            // Assert
            expect(html).toContain('Sin vencimiento');
        });

        it('should not render the price-drop section', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AlertDigestEmail(props));

            // Assert
            expect(html).not.toContain('Bajó el precio de tus alojamientos guardados');
        });
    });

    describe('when both priceDrop and promoOffers have items', () => {
        const props = makePayload({
            priceDrop: [makePriceDropMatch()],
            promoOffers: [makePromoOfferMatch()]
        });

        it('should render both sections without throwing', () => {
            // Arrange & Act
            const render = () => renderToStaticMarkup(AlertDigestEmail(props));

            // Assert
            expect(render).not.toThrow();
            const html = render();
            expect(html).toContain('Cabaña del Río');
            expect(html).toContain('Posada del Litoral');
        });
    });

    describe('when both priceDrop and promoOffers are empty', () => {
        const props = makePayload();

        it('should render the fallback text without throwing or crashing', () => {
            // Arrange & Act
            const render = () => renderToStaticMarkup(AlertDigestEmail(props));

            // Assert
            expect(render).not.toThrow();
            const html = render();
            expect(html).toContain('No encontramos novedades');
        });

        it('should not render either section', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AlertDigestEmail(props));

            // Assert
            expect(html).not.toContain('Bajó el precio de tus alojamientos guardados');
            expect(html).not.toContain('Ofertas activas para vos');
        });
    });

    it('should always include the manage-alerts CTA', () => {
        // Arrange
        const props = makePayload({ priceDrop: [makePriceDropMatch()] });

        // Act
        const html = renderToStaticMarkup(AlertDigestEmail(props));

        // Assert
        expect(html).toContain('Administrar mis alertas');
        expect(html).toContain('/mi-cuenta/alertas');
    });
});
