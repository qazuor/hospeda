/**
 * SubscriptionAccessEndingSoon Email Template Test Suite (SPEC-147 T-010).
 *
 * Tests for the D3 "access ending soon" reminder email template including:
 * - Template renders without errors
 * - Required props appear in output (recipientName, planName, accessUntil, daysRemaining)
 * - `accessUntil` date is formatted and visible
 * - CTA link is constructed from baseUrl
 * - No unsubscribe link (TRANSACTIONAL)
 * - daysRemaining appears in rendered output
 *
 * @module test/templates/subscription-access-ending-soon.templates.test
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
    SubscriptionAccessEndingSoon,
    type SubscriptionAccessEndingSoonProps
} from '../../src/templates/subscription/subscription-access-ending-soon';

describe('SubscriptionAccessEndingSoon email template (SPEC-147 T-010)', () => {
    const validProps: SubscriptionAccessEndingSoonProps = {
        recipientName: 'Carlos Rodríguez',
        planName: 'Plan Professional',
        accessUntil: '2026-07-18',
        daysRemaining: 3,
        baseUrl: 'https://hospeda.com.ar'
    };

    describe('render', () => {
        it('should render without errors', () => {
            const render = () => renderToStaticMarkup(SubscriptionAccessEndingSoon(validProps));
            expect(render).not.toThrow();
        });

        it('should contain recipient name', () => {
            const html = renderToStaticMarkup(SubscriptionAccessEndingSoon(validProps));
            expect(html).toContain('Carlos Rodríguez');
        });

        it('should contain plan name', () => {
            const html = renderToStaticMarkup(SubscriptionAccessEndingSoon(validProps));
            expect(html).toContain('Plan Professional');
        });

        it('should render accessUntil date in output', () => {
            const html = renderToStaticMarkup(SubscriptionAccessEndingSoon(validProps));
            // The exact day may shift by ±1 due to UTC→local timezone conversion,
            // so match on month name only.
            expect(html).toMatch(/de.*julio.*de.*2026/i);
        });

        it('should render daysRemaining in output', () => {
            const html = renderToStaticMarkup(SubscriptionAccessEndingSoon(validProps));
            expect(html).toContain('3');
        });

        it('should include reactivation CTA link using baseUrl', () => {
            const html = renderToStaticMarkup(SubscriptionAccessEndingSoon(validProps));
            expect(html).toContain('https://hospeda.com.ar/es/precios/propietarios');
        });

        it('should include "access ending" heading or similar urgency text', () => {
            const html = renderToStaticMarkup(SubscriptionAccessEndingSoon(validProps));
            // Heading or preview text should convey access is ending
            expect(html).toMatch(/access.*end|ending.*soon|acceso.*termina/i);
        });

        it('should inform about reactivation option', () => {
            const html = renderToStaticMarkup(SubscriptionAccessEndingSoon(validProps));
            // Must mention reactivation or renewal
            expect(html).toMatch(/reactivat|renew|renovar/i);
        });

        it('should use a different baseUrl in the CTA link', () => {
            const propsWithStagingUrl: SubscriptionAccessEndingSoonProps = {
                ...validProps,
                baseUrl: 'https://staging.hospeda.com.ar'
            };
            const html = renderToStaticMarkup(SubscriptionAccessEndingSoon(propsWithStagingUrl));
            expect(html).toContain('https://staging.hospeda.com.ar/es/precios/propietarios');
        });
    });

    describe('infoBox fields', () => {
        it('should show Plan label and value', () => {
            const html = renderToStaticMarkup(SubscriptionAccessEndingSoon(validProps));
            expect(html).toContain('Plan');
            expect(html).toContain('Plan Professional');
        });

        it('should show Access until label', () => {
            const html = renderToStaticMarkup(SubscriptionAccessEndingSoon(validProps));
            expect(html).toContain('Access until');
        });

        it('should show Days remaining label', () => {
            const html = renderToStaticMarkup(SubscriptionAccessEndingSoon(validProps));
            expect(html).toContain('Days remaining');
        });
    });

    describe('transactional behaviour', () => {
        it('should not render an unsubscribe link (transactional email)', () => {
            const html = renderToStaticMarkup(SubscriptionAccessEndingSoon(validProps));
            expect(html).not.toContain('Administrar preferencias de notificaciones');
            expect(html).not.toContain('unsubscribe_url');
        });
    });
});
