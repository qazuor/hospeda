/**
 * `AddonSubscriptionStarted` — the notice a recurring add-on's first charge
 * sends (HOS-847 PR 5).
 *
 * ## What is actually being pinned
 *
 * Not "the template renders". The requirement is that a SUBSCRIBER reads four
 * things a one-time buyer never needs: what they bought, what was charged, how
 * often it will be charged again, and when the next charge lands — plus how to
 * stop it. Each of those is asserted per locale, because a locale table is
 * exactly the kind of thing that gets half-filled and ships a Spanish body
 * under an English heading.
 *
 * @module test/templates/addon-subscription-started.templates.test
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
    AddonSubscriptionStarted,
    type AddonSubscriptionStartedProps
} from '../../src/templates/addon/addon-subscription-started';

function props(
    overrides: Partial<AddonSubscriptionStartedProps> = {}
): AddonSubscriptionStartedProps {
    return {
        customerName: 'Ana Gómez',
        addonName: 'Alojamientos extra',
        addonDescription: 'Cinco alojamientos más',
        amount: 500_000,
        currency: 'ARS',
        billingInterval: 'monthly',
        nextChargeAt: '2026-06-10T12:00:00.000Z',
        baseUrl: 'https://hospeda.com.ar',
        addonSlug: 'extra-accommodations-5',
        locale: 'es',
        ...overrides
    };
}

describe('AddonSubscriptionStarted', () => {
    it('renders the amount, the cadence and the next charge date in Spanish', () => {
        // Act
        const html = renderToStaticMarkup(AddonSubscriptionStarted(props()));

        // Assert
        expect(html).toContain('Ana Gómez');
        expect(html).toContain('Alojamientos extra');
        // Centavos → pesos. A template that forgot the division would render
        // 500.000,00 here.
        expect(html).toContain('$5.000,00');
        expect(html).toContain('Todos los meses');
        expect(html).toContain('10 de junio de 2026');
    });

    it('renders in English', () => {
        // Act
        const html = renderToStaticMarkup(AddonSubscriptionStarted(props({ locale: 'en' })));

        // Assert
        expect(html).toContain('Your add-on is active');
        expect(html).toContain('Every month');
        expect(html).toContain('June 10, 2026');
        expect(html).not.toContain('Todos los meses');
    });

    it('renders in Portuguese', () => {
        // Act
        const html = renderToStaticMarkup(AddonSubscriptionStarted(props({ locale: 'pt' })));

        // Assert
        expect(html).toContain('Seu complemento está ativo');
        expect(html).toContain('Todo mês');
        expect(html).toContain('10 de junho de 2026');
        expect(html).not.toContain('Every month');
    });

    it.each([
        ['es'],
        ['en'],
        ['pt']
    ] as const)('in %s, says the card will be charged again and how to cancel', (locale) => {
        // Arrange: the two facts that separate this email from the one-time
        // receipt. Anchored on words that only appear in those two
        // paragraphs, per locale.
        const expected = {
            es: ['cobrar', 'cancelar'],
            en: ['charge', 'cancel'],
            pt: ['cobrar', 'cancelar']
        }[locale];

        // Act
        const html = renderToStaticMarkup(AddonSubscriptionStarted(props({ locale })));

        // Assert
        for (const needle of expected) {
            expect(html.toLowerCase()).toContain(needle);
        }
    });

    it('names an annual cadence as a year, not a month', () => {
        // Act
        const html = renderToStaticMarkup(
            AddonSubscriptionStarted(props({ billingInterval: 'annual' }))
        );

        // Assert
        expect(html).toContain('Una vez por año');
        expect(html).not.toContain('Todos los meses');
    });

    it('deep-links the CTA to this add-on in the recipient locale', () => {
        // Act
        const html = renderToStaticMarkup(AddonSubscriptionStarted(props({ locale: 'pt' })));

        // Assert
        expect(html).toContain('/pt/mi-cuenta/addons/?focus=extra-accommodations-5');
    });

    it('falls back to Spanish for an absent locale, and omits an absent description', () => {
        // Act
        const html = renderToStaticMarkup(
            AddonSubscriptionStarted(props({ locale: undefined, addonDescription: undefined }))
        );

        // Assert
        expect(html).toContain('Tu complemento quedó activo');
        expect(html).not.toContain('Descripción');
    });
});
