/**
 * CommerceOwnerCredentials Email Template Test Suite (HOS-166 PR-C §7.5).
 *
 * Covers the rework that makes this template double as the "lead approved →
 * complete and publish" notification (see the template's module doc):
 * - Template renders without errors.
 * - Required props (recipientName, temporaryPassword, changePasswordUrl)
 *   appear in output.
 * - The CTA links to the change-password page, NEVER straight to checkout —
 *   the mustChangePasswordGate() 403s every other protected route until the
 *   password changes (HOS-166 §5.4).
 * - The new "complete → publish → pay" steps copy is present.
 * - No unsubscribe link (TRANSACTIONAL).
 *
 * @module test/templates/commerce-owner-credentials.templates.test
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
    CommerceOwnerCredentials,
    type CommerceOwnerCredentialsProps
} from '../../src/templates/commerce/commerce-owner-credentials';

describe('CommerceOwnerCredentials email template (HOS-166 PR-C)', () => {
    const validProps: CommerceOwnerCredentialsProps = {
        recipientName: 'Juan Pérez',
        temporaryPassword: 'Tmp-Pass-9x2Z',
        changePasswordUrl: 'https://hospeda.com.ar/mi-cuenta/cambiar-contrasena'
    };

    describe('render', () => {
        it('should render without errors', () => {
            const render = () => renderToStaticMarkup(CommerceOwnerCredentials(validProps));

            expect(render).not.toThrow();
        });

        it('should contain the recipient name', () => {
            const html = renderToStaticMarkup(CommerceOwnerCredentials(validProps));

            expect(html).toContain('Juan Pérez');
        });

        it('should contain the temporary password', () => {
            const html = renderToStaticMarkup(CommerceOwnerCredentials(validProps));

            expect(html).toContain('Tmp-Pass-9x2Z');
        });

        it('should link the CTA to the change-password URL, never to checkout', () => {
            const html = renderToStaticMarkup(CommerceOwnerCredentials(validProps));

            expect(html).toContain('https://hospeda.com.ar/mi-cuenta/cambiar-contrasena');
            expect(html).not.toContain('start-subscription');
            expect(html).not.toContain('checkout');
        });
    });

    describe('full-path narrative (HOS-166 §7.5)', () => {
        it('should mention completing the listing', () => {
            const html = renderToStaticMarkup(CommerceOwnerCredentials(validProps));

            expect(html).toContain('Completá los datos de tu comercio');
        });

        it('should mention publishing and paying', () => {
            const html = renderToStaticMarkup(CommerceOwnerCredentials(validProps));

            expect(html).toContain('Publicá y pagá la suscripción');
        });
    });

    describe('transactional behaviour', () => {
        it('should not render an unsubscribe link (transactional email)', () => {
            const html = renderToStaticMarkup(CommerceOwnerCredentials(validProps));

            expect(html).not.toContain('Administrar preferencias de notificaciones');
            expect(html).not.toContain('unsubscribe_url');
        });
    });
});
