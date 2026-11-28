/**
 * DirectEmail template test suite (HOS-2685).
 *
 * @module test/templates/direct-email.template.test
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DirectEmail } from '../../src/templates/direct-email/direct-email.js';
import { renderTiptapEmailContent } from '../../src/utils/tiptap-email-renderer.js';

const OPT_OUT_URL = 'https://hospeda.com.ar/es/correos/baja/?token=abc.def';

const baseProps = {
    subject: 'Propuesta comercial',
    bodyHtml: '<p>Hola equipo</p>',
    optOutUrl: OPT_OUT_URL
};

describe('DirectEmail template (HOS-2685)', () => {
    it('renders the body and the opt-out line linking to the opt-out URL', () => {
        // Arrange / Act
        const html = renderToStaticMarkup(DirectEmail(baseProps));

        // Assert
        expect(html).toContain('Hola equipo');
        expect(html).toContain('No quiero recibir más correos de Hospeda');
        expect(html).toContain(`href="${OPT_OUT_URL}"`);
    });

    it('opens with the subject as the title row the user layout requires', () => {
        // Arrange / Act
        const html = renderToStaticMarkup(DirectEmail(baseProps));

        // Assert
        expect(html).toContain('data-email-title="true"');
        expect(html).toContain('Propuesta comercial');
    });

    it('shows the [PRUEBA] banner only for a test send', () => {
        // Arrange / Act
        const real = renderToStaticMarkup(DirectEmail(baseProps));
        const test = renderToStaticMarkup(DirectEmail({ ...baseProps, isTest: true }));

        // Assert
        expect(real).not.toContain('[PRUEBA]');
        expect(test).toContain('[PRUEBA]');
    });

    it('strips javascript: links and raw HTML when the body goes through the renderer', () => {
        // Arrange
        const bodyHtml = renderTiptapEmailContent({
            content: {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'text',
                                text: 'clic',
                                marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]
                            },
                            { type: 'text', text: '<script>alert(2)</script>' }
                        ]
                    }
                ]
            }
        });

        // Act
        const html = renderToStaticMarkup(DirectEmail({ ...baseProps, bodyHtml }));

        // Assert
        expect(html).not.toContain('javascript:');
        expect(html).not.toContain('<script>alert');
    });
});
