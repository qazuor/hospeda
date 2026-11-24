/**
 * SubscriptionCancelConfirmed Email Template Test Suite (SPEC-147)
 *
 * Tests for the soft-cancel confirmation email template including:
 * - Template renders without errors
 * - Required props (recipientName, planName, accessUntil) appear in output
 * - `accessUntil` date is formatted and visible
 * - CTA link is constructed from baseUrl
 * - No unsubscribe link (TRANSACTIONAL)
 *
 * @module test/templates/subscription-cancel-confirmed.templates.test
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
    SubscriptionCancelConfirmed,
    type SubscriptionCancelConfirmedProps
} from '../../src/templates/subscription/subscription-cancel-confirmed';

describe('SubscriptionCancelConfirmed email template (SPEC-147)', () => {
    const validProps: SubscriptionCancelConfirmedProps = {
        recipientName: 'Maria Gómez',
        planName: 'Plan Standard',
        accessUntil: '2026-07-15',
        baseUrl: 'https://hospeda.com.ar'
    };

    describe('render', () => {
        it('should render without errors', () => {
            // Arrange & Act
            const render = () => renderToStaticMarkup(SubscriptionCancelConfirmed(validProps));

            // Assert
            expect(render).not.toThrow();
        });

        it('should contain recipient name', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(SubscriptionCancelConfirmed(validProps));

            // Assert
            expect(html).toContain('Maria Gómez');
        });

        it('should contain plan name', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(SubscriptionCancelConfirmed(validProps));

            // Assert
            expect(html).toContain('Plan Standard');
        });

        it('should render accessUntil date in output', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(SubscriptionCancelConfirmed(validProps));

            // Assert — date should appear formatted (Spanish locale long date).
            // The exact day may shift by ±1 due to UTC→local timezone conversion in
            // the test runner, so we match on month name only.
            expect(html).toMatch(/de.*julio.*de.*2026/i);
        });

        it('should include reactivation CTA link using baseUrl', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(SubscriptionCancelConfirmed(validProps));

            // Assert
            expect(html).toContain('https://hospeda.com.ar/es/mi-cuenta/suscripcion/');
        });

        it('should include cancellation confirmed heading', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(SubscriptionCancelConfirmed(validProps));

            // Assert
            expect(html).toContain('Confirmamos tu baja');
        });

        it('should inform that access is preserved until accessUntil', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(SubscriptionCancelConfirmed(validProps));

            // Assert
            expect(html).toContain('acceso completo hasta el');
        });

        it('should use a different baseUrl in the CTA link', () => {
            // Arrange
            const propsWithStagingUrl: SubscriptionCancelConfirmedProps = {
                ...validProps,
                baseUrl: 'https://staging.hospeda.com.ar'
            };

            // Act
            const html = renderToStaticMarkup(SubscriptionCancelConfirmed(propsWithStagingUrl));

            // Assert
            expect(html).toContain('https://staging.hospeda.com.ar/es/mi-cuenta/suscripcion/');
        });
    });

    describe('infoBox fields', () => {
        it('should show Plan label and value', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(SubscriptionCancelConfirmed(validProps));

            // Assert
            expect(html).toContain('Plan');
            expect(html).toContain('Plan Standard');
        });

        it('should show Access until label', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(SubscriptionCancelConfirmed(validProps));

            // Assert
            expect(html).toContain('Acceso hasta');
        });

        it('should show Status as cancelled at period end', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(SubscriptionCancelConfirmed(validProps));

            // Assert
            expect(html).toContain('Baja al final del período');
        });
    });

    describe('transactional behaviour', () => {
        it('should not render an unsubscribe link (transactional email)', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(SubscriptionCancelConfirmed(validProps));

            // Assert
            // HOS-2565 §8.3: the preferences link is a footer default, not an unsubscribe.
            expect(html).toContain('data-layout-link="preferences"');
            expect(html).not.toContain('unsubscribe_url');
        });
    });

    describe('language (HOS-2565 §7.1)', () => {
        it('should be Spanish only, with voseo and an "Hola" greeting', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(SubscriptionCancelConfirmed(validProps));
            const text = html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ');

            // Assert
            expect(text).toMatch(/Hola\s+\S.*,/);
            expect(text).not.toMatch(
                /\b(the|your|you|and|will|access|cancellation|choose|reactivate|Hi)\b/i
            );
        });
    });
});
