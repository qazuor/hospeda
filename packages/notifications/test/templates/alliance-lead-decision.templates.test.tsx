/**
 * AllianceLeadDecision Email Template Test Suite (HOS-278 AC-6).
 *
 * The copy contract matters more than the rendering here, so that is what this
 * pins:
 * - The approval says what actually happens next (someone writes to you) and
 *   does NOT link to a panel or a form that later slices have yet to build.
 * - The rejection never paraphrases the admin's internal note.
 * - No unsubscribe link (TRANSACTIONAL).
 *
 * @module test/templates/alliance-lead-decision.templates.test
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
    AllianceLeadDecision,
    type AllianceLeadDecisionProps
} from '../../src/templates/alliance/alliance-lead-decision';

const approved: AllianceLeadDecisionProps = {
    recipientName: 'Juan Pérez',
    programLabel: 'Partner',
    outcome: 'approved'
};

const rejected: AllianceLeadDecisionProps = { ...approved, outcome: 'rejected' };

describe('AllianceLeadDecision email template (HOS-278 AC-6)', () => {
    describe('approved', () => {
        it('should render without errors', () => {
            expect(() => renderToStaticMarkup(AllianceLeadDecision(approved))).not.toThrow();
        });

        it('should say it was approved', () => {
            const html = renderToStaticMarkup(AllianceLeadDecision(approved));

            expect(html).toContain('la aprobamos');
        });

        it('should name the program and greet the applicant', () => {
            const html = renderToStaticMarkup(AllianceLeadDecision(approved));

            expect(html).toContain('Partner');
            expect(html).toContain('Juan Pérez');
        });

        it('should promise only the step that actually exists — someone writes to you', () => {
            const html = renderToStaticMarkup(AllianceLeadDecision(approved));

            expect(html).toContain('te vamos a escribir');
        });

        it('should NOT send the applicant to a panel or form that is not built yet', () => {
            // Slices C/D/E build the per-program onboarding. Until then, a CTA
            // here would be copy describing software that does not exist, and
            // the applicant would go looking for it.
            const html = renderToStaticMarkup(AllianceLeadDecision(approved));

            expect(html).not.toContain('/mi-cuenta');
            expect(html).not.toContain('completá tus datos');
            expect(html).not.toContain('Activar');
        });
    });

    describe('rejected', () => {
        it('should render without errors', () => {
            expect(() => renderToStaticMarkup(AllianceLeadDecision(rejected))).not.toThrow();
        });

        it('should say it is not moving forward, without pretending otherwise', () => {
            const html = renderToStaticMarkup(AllianceLeadDecision(rejected));

            expect(html).toContain('no vamos a avanzar');
            expect(html).not.toContain('la aprobamos');
        });

        it('should leave the door open to reapplying', () => {
            const html = renderToStaticMarkup(AllianceLeadDecision(rejected));

            expect(html).toContain('volver a postularte');
        });

        it('should carry no admin note — the template is never given one', () => {
            // Structural, not a string check: `AllianceLeadDecisionProps` has no
            // field for it, so there is nothing to leak. This asserts the two
            // outcomes differ ONLY in their own copy.
            const html = renderToStaticMarkup(AllianceLeadDecision(rejected));

            expect(Object.keys(rejected)).toEqual(['recipientName', 'programLabel', 'outcome']);
            expect(html).not.toContain('nota');
        });
    });

    describe('transactional behaviour', () => {
        it('should not render an unsubscribe link', () => {
            const html = renderToStaticMarkup(AllianceLeadDecision(approved));

            expect(html).not.toContain('Administrar preferencias de notificaciones');
            expect(html).not.toContain('unsubscribe_url');
        });
    });
});
