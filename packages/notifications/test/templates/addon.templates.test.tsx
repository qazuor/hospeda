/**
 * Addon Email Templates Test Suite
 *
 * Tests for addon-related email templates including:
 * - Templates render without errors
 * - Templates include required fields from payload
 * - Spanish text is present
 * - Templates handle missing optional fields gracefully
 *
 * @module test/templates/addon.templates.test
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
    AddonCancellation,
    type AddonCancellationProps
} from '../../src/templates/addon/addon-cancellation';
import {
    AddonExpirationWarning,
    type AddonExpirationWarningProps
} from '../../src/templates/addon/addon-expiration-warning';
import { AddonExpired, type AddonExpiredProps } from '../../src/templates/addon/addon-expired';
import {
    AddonPurchaseConfirmation,
    type AddonPurchaseConfirmationProps
} from '../../src/templates/addon/addon-purchase-confirmation';
import {
    AddonRenewalConfirmation,
    type AddonRenewalConfirmationProps
} from '../../src/templates/addon/addon-renewal-confirmation';

describe('Addon Email Templates', () => {
    describe('AddonExpirationWarning', () => {
        const validProps: AddonExpirationWarningProps = {
            recipientName: 'Laura Fernández',
            addonName: 'Soporte Prioritario',
            baseUrl: 'https://hospeda.com.ar',
            daysRemaining: 5,
            expirationDate: '2024-12-31'
        };

        it('should render without errors', () => {
            // Arrange & Act
            const render = () => renderToStaticMarkup(AddonExpirationWarning(validProps));

            // Assert
            expect(render).not.toThrow();
        });

        it('should include required fields from payload', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AddonExpirationWarning(validProps));

            // Assert
            expect(html).toContain('Laura Fernández');
            expect(html).toContain('Soporte Prioritario');
            expect(html).toContain('5 días');
        });

        it('should include Spanish text', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AddonExpirationWarning(validProps));

            // Assert
            expect(html).toContain('complemento está por vencer');
            expect(html).toContain('Hola');
            expect(html).toContain('Complemento');
            expect(html).toContain('Tiempo restante');
            expect(html).toContain('renovarlo');
        });

        it('should handle missing optional days remaining gracefully', () => {
            // Arrange
            const propsWithoutDays: AddonExpirationWarningProps = {
                ...validProps,
                daysRemaining: undefined
            };

            // Act
            const render = () => renderToStaticMarkup(AddonExpirationWarning(propsWithoutDays));

            // Assert
            expect(render).not.toThrow();
            const html = render();
            // Should still contain addon name but not days remaining row
            expect(html).toContain('Soporte Prioritario');
        });

        it('should handle missing optional expiration date gracefully', () => {
            // Arrange
            const propsWithoutDate: AddonExpirationWarningProps = {
                ...validProps,
                expirationDate: undefined
            };

            // Act
            const render = () => renderToStaticMarkup(AddonExpirationWarning(propsWithoutDate));

            // Assert
            expect(render).not.toThrow();
            const html = render();
            expect(html).toContain('Soporte Prioritario');
        });

        it('should format expiration date in Spanish', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AddonExpirationWarning(validProps));

            // Assert
            // Should contain Spanish month name or formatted date
            expect(html).toMatch(/\d{1,2}.*de.*(diciembre|enero)/i);
        });

        it('should handle singular day correctly', () => {
            // Arrange
            const propsWithOneDay: AddonExpirationWarningProps = {
                ...validProps,
                daysRemaining: 1
            };

            // Act
            const html = renderToStaticMarkup(AddonExpirationWarning(propsWithOneDay));

            // Assert
            expect(html).toContain('1 día'); // Should be singular, not "1 días"
        });

        it('should include call-to-action button pointing at the add-ons page, not subscription', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AddonExpirationWarning(validProps));

            // Assert
            expect(html).toContain('Renovar ahora');
            expect(html).toContain('/mi-cuenta/addons/');
            expect(html).not.toContain('suscripcion');
        });

        it.each([
            ['es', 'https://hospeda.com.ar/es/mi-cuenta/addons/?focus=priority-support'],
            ['en', 'https://hospeda.com.ar/en/mi-cuenta/addons/?focus=priority-support'],
            ['pt', 'https://hospeda.com.ar/pt/mi-cuenta/addons/?focus=priority-support']
        ] as const)('renders a %s CTA href focused on the expiring add-on (HOS-722)', (locale, expectedHref) => {
            // Arrange
            const props: AddonExpirationWarningProps = {
                ...validProps,
                baseUrl: 'https://hospeda.com.ar',
                addonSlug: 'priority-support',
                locale
            };

            // Act
            const html = renderToStaticMarkup(AddonExpirationWarning(props));

            // Assert — regression check: reverting the template to the old
            // hardcoded `${baseUrl}/es/mi-cuenta/suscripcion` href makes this
            // fail for 'en' and 'pt' (wrong locale) and for all three (wrong
            // destination + missing focus param).
            expect(html).toContain(`href="${expectedHref}"`);
        });

        it('defaults to es and no focus param when locale/addonSlug are omitted', () => {
            // Arrange
            const props: AddonExpirationWarningProps = {
                ...validProps,
                addonSlug: undefined,
                locale: undefined
            };

            // Act
            const html = renderToStaticMarkup(AddonExpirationWarning(props));

            // Assert
            expect(html).toContain('href="https://hospeda.com.ar/es/mi-cuenta/addons/"');
            expect(html).not.toContain('focus=');
        });

        it('should include unsubscribe option', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AddonExpirationWarning(validProps));

            // Assert
            // Addon warnings are REMINDER category, should have unsubscribe
            expect(html).toContain('preferencias');
        });
    });

    describe('AddonExpired', () => {
        const validProps: AddonExpiredProps = {
            recipientName: 'Roberto Silva',
            addonName: 'Análisis Avanzado',
            baseUrl: 'https://hospeda.com.ar',
            expirationDate: '2024-12-15'
        };

        it('should render without errors', () => {
            // Arrange & Act
            const render = () => renderToStaticMarkup(AddonExpired(validProps));

            // Assert
            expect(render).not.toThrow();
        });

        it('should include required fields from payload', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AddonExpired(validProps));

            // Assert
            expect(html).toContain('Roberto Silva');
            expect(html).toContain('Análisis Avanzado');
        });

        it('should include Spanish text', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AddonExpired(validProps));

            // Assert
            expect(html).toContain('complemento ha vencido');
            expect(html).toContain('Hola');
            expect(html).toContain('ha vencido');
            expect(html).toContain('adquirirlo nuevamente');
        });

        it('should handle missing optional expiration date gracefully', () => {
            // Arrange
            const propsWithoutDate: AddonExpiredProps = {
                ...validProps,
                expirationDate: undefined
            };

            // Act
            const render = () => renderToStaticMarkup(AddonExpired(propsWithoutDate));

            // Assert
            expect(render).not.toThrow();
            const html = render();
            expect(html).toContain('Análisis Avanzado');
        });

        it('should format expiration date in Spanish', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AddonExpired(validProps));

            // Assert
            // Should contain Spanish month name or formatted date
            expect(html).toMatch(/\d{1,2}.*de.*(diciembre|noviembre|enero)/i);
        });

        it('should include call-to-action button pointing at the add-ons page, not subscription', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AddonExpired(validProps));

            // Assert
            expect(html).toContain('Comprar de nuevo');
            expect(html).toContain('/mi-cuenta/addons/');
            expect(html).not.toContain('suscripcion');
        });

        it.each([
            ['es', 'https://hospeda.com.ar/es/mi-cuenta/addons/?focus=advanced-analytics'],
            ['en', 'https://hospeda.com.ar/en/mi-cuenta/addons/?focus=advanced-analytics'],
            ['pt', 'https://hospeda.com.ar/pt/mi-cuenta/addons/?focus=advanced-analytics']
        ] as const)('renders a %s CTA href focused on the expired add-on (HOS-722)', (locale, expectedHref) => {
            // Arrange
            const props: AddonExpiredProps = {
                ...validProps,
                baseUrl: 'https://hospeda.com.ar',
                addonSlug: 'advanced-analytics',
                locale
            };

            // Act
            const html = renderToStaticMarkup(AddonExpired(props));

            // Assert — regression check: reverting the template to the old
            // hardcoded `${baseUrl}/es/mi-cuenta/suscripcion` href makes this
            // fail for 'en' and 'pt' (wrong locale) and for all three (wrong
            // destination + missing focus param).
            expect(html).toContain(`href="${expectedHref}"`);
        });

        it('defaults to es and no focus param when locale/addonSlug are omitted', () => {
            // Arrange
            const props: AddonExpiredProps = {
                ...validProps,
                addonSlug: undefined,
                locale: undefined
            };

            // Act
            const html = renderToStaticMarkup(AddonExpired(props));

            // Assert
            expect(html).toContain('href="https://hospeda.com.ar/es/mi-cuenta/addons/"');
            expect(html).not.toContain('focus=');
        });
    });

    describe('AddonRenewalConfirmation', () => {
        const validProps: AddonRenewalConfirmationProps = {
            recipientName: 'Sofía Torres',
            addonName: 'Soporte 24/7',
            baseUrl: 'https://hospeda.com.ar',
            amount: 5000,
            currency: 'ARS'
        };

        it('should render without errors', () => {
            // Arrange & Act
            const render = () => renderToStaticMarkup(AddonRenewalConfirmation(validProps));

            // Assert
            expect(render).not.toThrow();
        });

        it('should include required fields from payload', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AddonRenewalConfirmation(validProps));

            // Assert
            expect(html).toContain('Sofía Torres');
            expect(html).toContain('Soporte 24/7');
            expect(html).toContain('$50'); // Formatted amount
        });

        it('should include Spanish text', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AddonRenewalConfirmation(validProps));

            // Assert
            expect(html).toContain('Complemento renovado exitosamente');
            expect(html).toContain('Hola');
            expect(html).toContain('ha sido renovado exitosamente');
            expect(html).toContain('Monto');
        });

        it('should handle missing optional amount gracefully', () => {
            // Arrange
            const propsWithoutAmount: AddonRenewalConfirmationProps = {
                ...validProps,
                amount: undefined
            };

            // Act
            const render = () => renderToStaticMarkup(AddonRenewalConfirmation(propsWithoutAmount));

            // Assert
            expect(render).not.toThrow();
            const html = render();
            expect(html).toContain('Soporte 24/7');
        });

        it('should handle missing optional currency gracefully', () => {
            // Arrange
            const propsWithoutCurrency: AddonRenewalConfirmationProps = {
                ...validProps,
                currency: undefined
            };

            // Act
            const render = () =>
                renderToStaticMarkup(AddonRenewalConfirmation(propsWithoutCurrency));

            // Assert
            expect(render).not.toThrow();
        });

        it('should format currency correctly for ARS', () => {
            // Arrange
            const props: AddonRenewalConfirmationProps = {
                ...validProps,
                amount: 12500,
                currency: 'ARS'
            };

            // Act
            const html = renderToStaticMarkup(AddonRenewalConfirmation(props));

            // Assert
            expect(html).toContain('$125'); // Peso sign and formatting
        });

        it('should format currency correctly for USD', () => {
            // Arrange
            const props: AddonRenewalConfirmationProps = {
                ...validProps,
                amount: 2500,
                currency: 'USD'
            };

            // Act
            const html = renderToStaticMarkup(AddonRenewalConfirmation(props));

            // Assert
            expect(html).toContain('USD');
        });

        it('CTA points at the add-ons page in the recipient locale, not subscription (HOS-722)', () => {
            // Arrange
            const props: AddonRenewalConfirmationProps = {
                ...validProps,
                baseUrl: 'https://hospeda.com.ar',
                addonSlug: '24-7-support',
                locale: 'pt'
            };

            // Act
            const html = renderToStaticMarkup(AddonRenewalConfirmation(props));

            // Assert
            expect(html).toContain(
                'href="https://hospeda.com.ar/pt/mi-cuenta/addons/?focus=24-7-support"'
            );
            expect(html).not.toContain('suscripcion');
        });
    });

    describe('AddonCancellation — CTA destination (HOS-722)', () => {
        const validProps: AddonCancellationProps = {
            recipientName: 'Marcos Díaz',
            addonName: 'Fotos extra',
            canceledAt: '2026-03-17T10:00:00.000Z',
            baseUrl: 'https://hospeda.com.ar'
        };

        it('renders without errors', () => {
            const render = () => renderToStaticMarkup(AddonCancellation(validProps));
            expect(render).not.toThrow();
        });

        it('CTA points at the add-ons page in the recipient locale, not subscription', () => {
            // Arrange
            const props: AddonCancellationProps = {
                ...validProps,
                addonSlug: 'extra-photos',
                locale: 'en'
            };

            // Act
            const html = renderToStaticMarkup(AddonCancellation(props));

            // Assert
            expect(html).toContain(
                'href="https://hospeda.com.ar/en/mi-cuenta/addons/?focus=extra-photos"'
            );
            expect(html).not.toContain('suscripcion');
        });

        it('defaults to es with no focus param when locale/addonSlug are omitted', () => {
            const html = renderToStaticMarkup(AddonCancellation(validProps));
            expect(html).toContain('href="https://hospeda.com.ar/es/mi-cuenta/addons/"');
            expect(html).not.toContain('focus=');
        });
    });

    describe('AddonPurchaseConfirmation — CTA destination (HOS-722)', () => {
        const validProps: AddonPurchaseConfirmationProps = {
            customerName: 'Valeria Ortiz',
            addonName: 'Soporte Prioritario',
            addonDescription: 'Soporte con respuesta en menos de 24hs',
            expiresAt: '2026-06-01T00:00:00.000Z',
            orderId: 'ORD-123',
            amount: 150000,
            baseUrl: 'https://hospeda.com.ar'
        };

        it('renders without errors', () => {
            const render = () => renderToStaticMarkup(AddonPurchaseConfirmation(validProps));
            expect(render).not.toThrow();
        });

        it('CTA points at the add-ons page in the recipient locale, not subscription', () => {
            // Arrange
            const props: AddonPurchaseConfirmationProps = {
                ...validProps,
                addonSlug: 'priority-support',
                locale: 'pt'
            };

            // Act
            const html = renderToStaticMarkup(AddonPurchaseConfirmation(props));

            // Assert
            expect(html).toContain(
                'href="https://hospeda.com.ar/pt/mi-cuenta/addons/?focus=priority-support"'
            );
            expect(html).not.toContain('suscripcion');
        });
    });
});
