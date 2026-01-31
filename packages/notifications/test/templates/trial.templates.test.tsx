/**
 * Trial Email Templates Test Suite
 *
 * Tests for trial-related email templates including:
 * - Templates render without errors
 * - Templates include required fields from payload
 * - Spanish text is present
 * - Templates handle missing optional fields gracefully
 *
 * @module test/templates/trial.templates.test
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
    TrialEndingReminder,
    type TrialEndingReminderProps
} from '../../src/templates/trial/trial-ending-reminder';
import { TrialExpired, type TrialExpiredProps } from '../../src/templates/trial/trial-expired';

describe('Trial Email Templates', () => {
    describe('TrialEndingReminder', () => {
        const validProps: TrialEndingReminderProps = {
            recipientName: 'Gabriela Ruiz',
            planName: 'Plan Premium',
            trialEndDate: '2024-12-31',
            daysRemaining: 3,
            upgradeUrl: 'https://hospeda.com.ar/precios'
        };

        it('should render without errors', () => {
            // Arrange & Act
            const render = () => renderToStaticMarkup(TrialEndingReminder(validProps));

            // Assert
            expect(render).not.toThrow();
        });

        it('should include required fields from payload', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(TrialEndingReminder(validProps));

            // Assert
            expect(html).toContain('Gabriela Ruiz');
            expect(html).toContain('Plan Premium');
            expect(html).toContain('3 días');
            expect(html).toContain('https://hospeda.com.ar/precios');
        });

        it('should include Spanish text', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(TrialEndingReminder(validProps));

            // Assert
            expect(html).toContain('período de prueba está por finalizar');
            expect(html).toContain('Hola');
            expect(html).toContain('Plan de prueba');
            expect(html).toContain('Tiempo restante');
            expect(html).toContain('Fecha de finalización');
            expect(html).toContain('suscríbete');
        });

        it('should handle missing optional days remaining gracefully', () => {
            // Arrange
            const propsWithoutDays: TrialEndingReminderProps = {
                ...validProps,
                daysRemaining: undefined
            };

            // Act
            const render = () => renderToStaticMarkup(TrialEndingReminder(propsWithoutDays));

            // Assert
            expect(render).not.toThrow();
            const html = render();
            expect(html).toContain('Plan Premium');
        });

        it('should format trial end date in Spanish', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(TrialEndingReminder(validProps));

            // Assert
            // Should contain Spanish month name or formatted date
            expect(html).toMatch(/\d{1,2}.*de.*(diciembre|enero)/i);
        });

        it('should handle singular day correctly', () => {
            // Arrange
            const propsWithOneDay: TrialEndingReminderProps = {
                ...validProps,
                daysRemaining: 1
            };

            // Act
            const html = renderToStaticMarkup(TrialEndingReminder(propsWithOneDay));

            // Assert
            expect(html).toContain('1 día'); // Should be singular
        });

        it('should include call-to-action button with upgrade URL', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(TrialEndingReminder(validProps));

            // Assert
            expect(html).toContain('Ver planes y precios');
            expect(html).toContain('https://hospeda.com.ar/precios');
        });

        it('should include unsubscribe option', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(TrialEndingReminder(validProps));

            // Assert
            // Trial reminders are REMINDER category, should have unsubscribe
            expect(html).toContain('preferencias');
        });

        it('should handle different upgrade URLs correctly', () => {
            // Arrange
            const propsWithCustomUrl: TrialEndingReminderProps = {
                ...validProps,
                upgradeUrl: 'https://custom.url/upgrade?ref=trial'
            };

            // Act
            const html = renderToStaticMarkup(TrialEndingReminder(propsWithCustomUrl));

            // Assert
            expect(html).toContain('https://custom.url/upgrade?ref=trial');
        });
    });

    describe('TrialExpired', () => {
        const validProps: TrialExpiredProps = {
            recipientName: 'Martín Castro',
            planName: 'Plan Standard',
            trialEndDate: '2024-12-15',
            upgradeUrl: 'https://hospeda.com.ar/precios'
        };

        it('should render without errors', () => {
            // Arrange & Act
            const render = () => renderToStaticMarkup(TrialExpired(validProps));

            // Assert
            expect(render).not.toThrow();
        });

        it('should include required fields from payload', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(TrialExpired(validProps));

            // Assert
            expect(html).toContain('Martín Castro');
            expect(html).toContain('Plan Standard');
            expect(html).toContain('https://hospeda.com.ar/precios');
        });

        it('should include Spanish text', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(TrialExpired(validProps));

            // Assert
            expect(html).toContain('período de prueba ha finalizado');
            expect(html).toContain('Hola');
            expect(html).toContain('ha finalizado');
            expect(html).toContain('Suscríbete ahora');
        });

        it('should format trial end date in Spanish', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(TrialExpired(validProps));

            // Assert
            // Should contain Spanish month name or formatted date
            expect(html).toMatch(/\d{1,2}.*de.*(diciembre|noviembre|enero)/i);
        });

        it('should include call-to-action button with upgrade URL', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(TrialExpired(validProps));

            // Assert
            expect(html).toContain('Suscribirse ahora');
            expect(html).toContain('https://hospeda.com.ar/precios');
        });

        it('should handle different upgrade URLs correctly', () => {
            // Arrange
            const propsWithCustomUrl: TrialExpiredProps = {
                ...validProps,
                upgradeUrl: 'https://app.hospeda.com/billing/upgrade'
            };

            // Act
            const html = renderToStaticMarkup(TrialExpired(propsWithCustomUrl));

            // Assert
            expect(html).toContain('https://app.hospeda.com/billing/upgrade');
        });

        it('should communicate urgency in expired trial', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(TrialExpired(validProps));

            // Assert
            // Should convey that trial has ended and action is needed
            expect(html).toContain('ha finalizado');
            expect(html).toContain('Suscríbete ahora');
        });

        it('should explain consequences of not upgrading', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(TrialExpired(validProps));

            // Assert
            // Should mention limited access or features no longer available
            expect(html).toMatch(/funcionalidades que ya no están disponibles|plan gratuito/i);
        });
    });
});
