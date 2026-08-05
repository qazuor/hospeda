/**
 * AllianceClaimInvite Email Template Test Suite (HOS-278 §6.2).
 *
 * The recipient of this email may NOT be the person who applied — that is the
 * entire premise of the message. So the suite asserts the copy contract, not
 * just that it renders:
 * - The claim URL is the only CTA, and the expiry is stated.
 * - Doing nothing is presented as a valid, complete answer (AC-4: no click, no
 *   link).
 * - Nothing the applicant typed leaks to a recipient who may be a stranger.
 * - No unsubscribe link (TRANSACTIONAL).
 *
 * @module test/templates/alliance-claim-invite.templates.test
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
    AllianceClaimInvite,
    type AllianceClaimInviteProps
} from '../../src/templates/alliance/alliance-claim-invite';

describe('AllianceClaimInvite email template (HOS-278)', () => {
    const validProps: AllianceClaimInviteProps = {
        recipientName: 'Juan Pérez',
        programLabel: 'Partner',
        claimUrl: 'https://hospeda.com.ar/mi-cuenta/aliados?lead=lead-uuid&claim=TOKEN-123',
        expiresAtLabel: '11 de agosto de 2026'
    };

    describe('render', () => {
        it('should render without errors', () => {
            const render = () => renderToStaticMarkup(AllianceClaimInvite(validProps));

            expect(render).not.toThrow();
        });

        it('should address the account owner by name', () => {
            const html = renderToStaticMarkup(AllianceClaimInvite(validProps));

            expect(html).toContain('Juan Pérez');
        });

        it('should name the program applied to, not a raw slug', () => {
            const html = renderToStaticMarkup(AllianceClaimInvite(validProps));

            expect(html).toContain('Partner');
            expect(html).not.toContain('service_provider');
        });

        it('should link the CTA to the claim URL', () => {
            const html = renderToStaticMarkup(AllianceClaimInvite(validProps));

            expect(html).toContain(
                'https://hospeda.com.ar/mi-cuenta/aliados?lead=lead-uuid&amp;claim=TOKEN-123'
            );
        });

        it('should state when the link expires', () => {
            const html = renderToStaticMarkup(AllianceClaimInvite(validProps));

            expect(html).toContain('11 de agosto de 2026');
        });
    });

    describe('copy contract for a recipient who did NOT apply (AC-4)', () => {
        it('should say the application is not linked to their account yet', () => {
            const html = renderToStaticMarkup(AllianceClaimInvite(validProps));

            expect(html).toContain('no la vinculamos a tu cuenta');
        });

        it('should present doing nothing as a complete answer', () => {
            const html = renderToStaticMarkup(AllianceClaimInvite(validProps));

            expect(html).toContain('Si no fuiste vos, no hagas nada.');
        });

        it('should never call it "your application"', () => {
            const html = renderToStaticMarkup(AllianceClaimInvite(validProps));

            expect(html).not.toContain('tu postulación');
        });
    });

    describe('transactional behaviour', () => {
        it('should not render an unsubscribe link (transactional email)', () => {
            const html = renderToStaticMarkup(AllianceClaimInvite(validProps));

            expect(html).not.toContain('Administrar preferencias de notificaciones');
            expect(html).not.toContain('unsubscribe_url');
        });
    });
});
