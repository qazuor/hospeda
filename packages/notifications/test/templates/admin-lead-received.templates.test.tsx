/**
 * AdminLeadReceived Email Template Test Suite (H-62 / H-148).
 *
 * The point of this email is that a lead stops depending on somebody opening
 * the admin unprompted. So what matters is not that it renders — it is that
 * everything needed to ACT is inside it. A version that rendered beautifully
 * and said only "there is a new lead" would rebuild the original defect one
 * click further along, and would pass any test that only checked for a heading.
 *
 * @module test/templates/admin-lead-received.templates.test
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
    AdminLeadReceived,
    type AdminLeadReceivedProps
} from '../../src/templates/admin/admin-lead-received';

const alliance: AdminLeadReceivedProps = {
    funnelLabel: 'Aliados',
    programLabel: 'Proveedor',
    contactName: 'Juan Pérez',
    contactEmail: 'juan@example.com',
    contactPhone: '+54 9 11 1234-5678',
    businessName: 'Plomería Acme',
    message: 'Ofrezco 10% de descuento a los anfitriones de Concepción.',
    adminUrl: 'https://admin.hospeda.com.ar/platform/alliance-leads',
    submittedAtLabel: '15 de agosto de 2026, 18:30'
};

/** The commerce funnel collects no phone and often no message. */
const commerceMinimal: AdminLeadReceivedProps = {
    funnelLabel: 'Comercios',
    programLabel: 'Gastronomía',
    contactName: 'María García',
    contactEmail: 'maria@example.com',
    adminUrl: 'https://admin.hospeda.com.ar/platform/commerce-leads',
    submittedAtLabel: '15 de agosto de 2026, 19:05'
};

describe('AdminLeadReceived email template (H-62 / H-148)', () => {
    it('renders without errors', () => {
        expect(() => renderToStaticMarkup(AdminLeadReceived(alliance))).not.toThrow();
    });

    it('carries everything needed to answer without opening the admin', () => {
        const html = renderToStaticMarkup(AdminLeadReceived(alliance));

        expect(html).toContain('Proveedor');
        expect(html).toContain('Aliados');
        expect(html).toContain('Plomería Acme');
        expect(html).toContain('Juan Pérez');
        expect(html).toContain('juan@example.com');
        expect(html).toContain('15 de agosto de 2026, 18:30');
    });

    it('reproduces the applicant message verbatim and whole', () => {
        // The four "aliados" forms fold their per-kind answers into this field —
        // a service_provider states its benefit here and nowhere else — so a
        // truncated preview drops the one thing that decides the outcome.
        const html = renderToStaticMarkup(AdminLeadReceived(alliance));

        expect(html).toContain('Ofrezco 10% de descuento a los anfitriones de Concepción.');
        expect(html).not.toContain('…');
        expect(html).not.toContain('...');
    });

    it('links to the queue that resolves this funnel', () => {
        const html = renderToStaticMarkup(AdminLeadReceived(alliance));

        expect(html).toContain('https://admin.hospeda.com.ar/platform/alliance-leads');
    });

    it('points a commerce lead at the commerce queue, not the alliance one', () => {
        const html = renderToStaticMarkup(AdminLeadReceived(commerceMinimal));

        expect(html).toContain('/platform/commerce-leads');
        expect(html).not.toContain('/platform/alliance-leads');
    });

    it('omits the optional rows rather than rendering empty labels', () => {
        const html = renderToStaticMarkup(AdminLeadReceived(commerceMinimal));

        expect(html).toContain('maria@example.com');
        expect(html).not.toContain('Teléfono');
        expect(html).not.toContain('Negocio');
        expect(html).not.toContain('Lo que escribió');
    });

    it('renders no unsubscribe link', () => {
        // An internal operations alert. Offering to unsubscribe from it would
        // be offering to restore the bug it exists to close.
        const html = renderToStaticMarkup(AdminLeadReceived(alliance));

        expect(html).not.toContain('Administrar preferencias de notificaciones');
        expect(html).not.toContain('unsubscribe_url');
    });
});
