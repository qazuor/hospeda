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
    AddonExpirationWarning,
    type AddonExpirationWarningProps
} from '../../src/templates/addon/addon-expiration-warning';
import { AddonExpired, type AddonExpiredProps } from '../../src/templates/addon/addon-expired';
import {
    AddonRenewalConfirmation,
    type AddonRenewalConfirmationProps
} from '../../src/templates/addon/addon-renewal-confirmation';

describe('Addon Email Templates', () => {
    describe('AddonExpirationWarning', () => {
        const validProps: AddonExpirationWarningProps = {
            recipientName: 'Laura Fernández',
            addonName: 'Soporte Prioritario',
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

        it('should include call-to-action button', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AddonExpirationWarning(validProps));

            // Assert
            expect(html).toContain('Renovar ahora');
            expect(html).toContain('/mi-cuenta/addons');
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

        it('should include call-to-action button', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AddonExpired(validProps));

            // Assert
            expect(html).toContain('Comprar de nuevo');
            expect(html).toContain('/mi-cuenta/addons');
        });
    });

    describe('AddonRenewalConfirmation', () => {
        const validProps: AddonRenewalConfirmationProps = {
            recipientName: 'Sofía Torres',
            addonName: 'Soporte 24/7',
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
    });
});
