import { describe, expect, it } from 'vitest';
import { renderEmailBodies } from '../../src/render.js';
import {
    EMAIL_LOGO_HEIGHT,
    EMAIL_LOGO_URL,
    EMAIL_LOGO_WIDTH,
    EMAIL_PREFERENCES_URL,
    EMAIL_PUBLIC_SITE_URL,
    EmailLayout
} from '../../src/templates/email-layout.js';

const FOOTER_BRAND_LINE = 'Hospeda - Turismo en el Litoral';
const FOOTER_DESCRIPTION =
    'Plataforma de alojamientos turísticos en Concepción del Uruguay y la región del Litoral argentino';
const PREFERENCES_TEXT = 'Administrar preferencias de notificaciones';
const TAGLINE = 'Turismo en el Litoral</p>';

/**
 * Unit tests for the unified EmailLayout (HOS-2519 §5.1).
 */
describe('EmailLayout', () => {
    it('renders children inside one Spanish, light-only document', async () => {
        // Arrange & Act
        const { html } = await renderEmailBodies({
            react: (
                <EmailLayout previewText="Vista previa">
                    <p>Contenido del email</p>
                </EmailLayout>
            )
        });

        // Assert
        expect(html.match(/<html[^>]*lang="es"/g)).toHaveLength(1);
        expect(html).toContain('dir="ltr"');
        expect(html).toContain('<meta name="color-scheme" content="light"/>');
        expect(html).toContain('<meta name="supported-color-schemes" content="light"/>');
        expect(html).toContain('Contenido del email');
        expect(html).toContain('Vista previa');
    });

    it('renders the hosted logo with explicit size and alt text', async () => {
        // Arrange & Act
        const { html } = await renderEmailBodies({
            react: (
                <EmailLayout>
                    <p>x</p>
                </EmailLayout>
            )
        });

        // Assert
        expect(EMAIL_LOGO_URL).toBe('https://hospeda.com.ar/email/hospeda-logo@2x.png');
        expect(html).toContain(`src="${EMAIL_LOGO_URL}"`);
        expect(html).toContain('alt="Hospeda"');
        expect(html).toContain(`width="${EMAIL_LOGO_WIDTH}"`);
        expect(html).toContain(`height="${EMAIL_LOGO_HEIGHT}"`);
        expect(html).toContain(TAGLINE);
    });

    it('omits the preheader when previewText is not set', async () => {
        // Arrange & Act
        const withPreview = await renderEmailBodies({
            react: (
                <EmailLayout previewText="Preheader único">
                    <p>x</p>
                </EmailLayout>
            )
        });
        const withoutPreview = await renderEmailBodies({
            react: (
                <EmailLayout>
                    <p>x</p>
                </EmailLayout>
            )
        });

        // Assert
        expect(withPreview.html.length).toBeGreaterThan(withoutPreview.html.length);
        expect(withoutPreview.html).not.toContain('Preheader único');
    });

    it('renders the footer lines verbatim and a link to the site home', async () => {
        // Arrange & Act
        const { html } = await renderEmailBodies({
            react: (
                <EmailLayout>
                    <p>x</p>
                </EmailLayout>
            )
        });

        // Assert
        expect(html).toContain(FOOTER_BRAND_LINE);
        expect(html.replace(/\s+/g, ' ')).toContain(FOOTER_DESCRIPTION);
        expect(html).toContain(`href="${EMAIL_PUBLIC_SITE_URL}"`);
        expect(html).toContain('hospeda.com.ar</a>');
    });

    it('defaults to footerLink none (no preferences link)', async () => {
        // Arrange & Act
        const { html } = await renderEmailBodies({
            react: (
                <EmailLayout>
                    <p>x</p>
                </EmailLayout>
            )
        });

        // Assert
        expect(html).not.toContain(PREFERENCES_TEXT);
        expect(html).not.toContain(EMAIL_PREFERENCES_URL);
    });

    it('renders the absolute preferences link when footerLink is preferences (AC-2.2)', async () => {
        // Arrange & Act
        const { html } = await renderEmailBodies({
            react: (
                <EmailLayout footerLink="preferences">
                    <p>x</p>
                </EmailLayout>
            )
        });

        // Assert
        expect(EMAIL_PREFERENCES_URL).toBe('https://hospeda.com.ar/es/mi-cuenta/preferencias/');
        expect(html).toMatch(
            /<a href="https:\/\/hospeda\.com\.ar\/es\/mi-cuenta\/preferencias\/"[^>]*>Administrar preferencias de notificaciones<\/a>/
        );
        expect(html).not.toContain('{{');
        expect(html).not.toContain('unsubscribe_url');
    });

    it('uses only email-safe inline CSS', async () => {
        // Arrange & Act
        const { html } = await renderEmailBodies({
            react: (
                <EmailLayout footerLink="preferences">
                    <p>x</p>
                </EmailLayout>
            )
        });

        // Assert
        for (const forbidden of ['oklch(', 'var(--', 'display:flex', 'display:grid', '<svg']) {
            expect(html).not.toContain(forbidden);
        }
        expect(html).toContain('max-width:600px');
    });

    it('keeps the logo URL and tagline out of the text part (AC-3.2)', async () => {
        // Arrange & Act
        const { text } = await renderEmailBodies({
            react: (
                <EmailLayout
                    previewText="Vista previa"
                    footerLink="preferences"
                >
                    <p>Cuerpo del mensaje</p>
                </EmailLayout>
            )
        });

        // Assert
        expect(text).toContain('Cuerpo del mensaje');
        expect(text).toContain(FOOTER_BRAND_LINE);
        expect(text).toContain(PREFERENCES_TEXT);
        expect(text).not.toContain(EMAIL_LOGO_URL);
        expect(text.replace(FOOTER_BRAND_LINE, '')).not.toContain('Turismo en el Litoral');
    });
});
