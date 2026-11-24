/**
 * PlanBeingRetired Email Template Test Suite (SPEC-148 T-004).
 *
 * Tests for the plan-retirement notification email template including:
 * - Template renders without errors
 * - Required props (recipientName, planName, accessUntil, migrationHint) appear in output
 * - `accessUntil` date is formatted and visible (not raw ISO)
 * - migrationHint text is rendered in the body
 * - CTA link is constructed from baseUrl
 * - No unsubscribe link (TRANSACTIONAL)
 *
 * @module test/templates/plan-being-retired.templates.test
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
    PlanBeingRetired,
    type PlanBeingRetiredProps
} from '../../src/templates/subscription/plan-being-retired';

describe('PlanBeingRetired email template (SPEC-148)', () => {
    const validProps: PlanBeingRetiredProps = {
        recipientName: 'Carlos Rodríguez',
        planName: 'Plan Pro',
        accessUntil: '2026-08-15',
        migrationHint: 'Suscribite a otro plan para conservar tus beneficios',
        baseUrl: 'https://hospeda.com.ar'
    };

    describe('render', () => {
        it('should render without errors', () => {
            // Arrange & Act
            const render = () => renderToStaticMarkup(PlanBeingRetired(validProps));

            // Assert
            expect(render).not.toThrow();
        });

        it('should contain recipient name', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(PlanBeingRetired(validProps));

            // Assert
            expect(html).toContain('Carlos Rodríguez');
        });

        it('should contain plan name', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(PlanBeingRetired(validProps));

            // Assert
            expect(html).toContain('Plan Pro');
        });

        it('should render accessUntil date formatted (not raw ISO)', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(PlanBeingRetired(validProps));

            // Assert — formatted date should appear (Spanish locale long date).
            // The exact day may shift by ±1 due to UTC→local timezone conversion in
            // the test runner, so we match on month name only.
            expect(html).toMatch(/de.*agosto.*de.*2026/i);
            // Raw ISO string must NOT appear in the output
            expect(html).not.toContain('2026-08-15T');
        });

        it('should render the migrationHint text', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(PlanBeingRetired(validProps));

            // Assert
            expect(html).toContain('Suscribite a otro plan para conservar tus beneficios');
        });

        it('should include CTA link using baseUrl', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(PlanBeingRetired(validProps));

            // Assert
            expect(html).toContain('https://hospeda.com.ar/es/mi-cuenta/suscripcion/');
        });

        it('should include plan retirement heading', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(PlanBeingRetired(validProps));

            // Assert
            expect(html).toContain('Novedades importantes sobre tu plan');
        });

        it('should inform that access is preserved until accessUntil', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(PlanBeingRetired(validProps));

            // Assert
            expect(html).toContain('acceso completo hasta el');
        });

        it('should work with a different baseUrl', () => {
            // Arrange
            const propsWithStagingUrl: PlanBeingRetiredProps = {
                ...validProps,
                baseUrl: 'https://staging.hospeda.com.ar'
            };

            // Act
            const html = renderToStaticMarkup(PlanBeingRetired(propsWithStagingUrl));

            // Assert
            expect(html).toContain('https://staging.hospeda.com.ar/es/mi-cuenta/suscripcion/');
        });
    });

    describe('infoBox fields', () => {
        it('should show Plan being retired label and plan name', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(PlanBeingRetired(validProps));

            // Assert
            expect(html).toContain('Plan que deja de ofrecerse');
            expect(html).toContain('Plan Pro');
        });

        it('should show Access until label', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(PlanBeingRetired(validProps));

            // Assert
            expect(html).toContain('Acceso hasta');
        });

        it('should show Status as retiring at period end', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(PlanBeingRetired(validProps));

            // Assert
            expect(html).toContain('Deja de ofrecerse');
        });
    });

    describe('transactional behaviour', () => {
        it('should not render an unsubscribe link (transactional email)', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(PlanBeingRetired(validProps));

            // Assert
            expect(html).not.toContain('Administrar preferencias de notificaciones');
            expect(html).not.toContain('unsubscribe_url');
        });
    });

    describe('language (HOS-2565 §7.1)', () => {
        it('should be Spanish only, with voseo and an "Hola" greeting', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(PlanBeingRetired(validProps));
            const text = html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ');

            // Assert
            expect(text).toMatch(/Hola\s+\S.*,/);
            expect(text).not.toMatch(
                /\b(the|your|you|and|will|access|cancellation|choose|reactivate|Hi)\b/i
            );
        });
    });
});
