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
});
