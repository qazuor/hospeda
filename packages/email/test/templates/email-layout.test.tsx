import { afterEach, describe, expect, it } from 'vitest';
import { EMAIL_BUTTON_MEDIA_RULE } from '../../src/components/button.js';
import { configureEmailAssets, resetEmailAssets } from '../../src/email-assets.js';
import { renderEmailBodies } from '../../src/render.js';
import {
    EMAIL_ISOTIPO_HEIGHT,
    EMAIL_ISOTIPO_URL,
    EMAIL_ISOTIPO_WIDTH,
    EMAIL_PREFERENCES_URL,
    EMAIL_PUBLIC_SITE_URL,
    EmailLayout
} from '../../src/templates/email-layout.js';

const TEST_ATTRIBUTION = {
    medium: 'transactional',
    templateKey: 'test.layout',
    includePixel: false
} as const;

const FOOTER_BRAND_LINE = 'Hospeda - Turismo en el Litoral';
const FOOTER_DESCRIPTION =
    'Plataforma de alojamientos turísticos en Concepción del Uruguay y la región del Litoral argentino';
const PREFERENCES_TEXT = 'Administrar preferencias de notificaciones';
const TAGLINE = 'Turismo en el Litoral</p>';

/**
 * Unit tests for the STAFF variant of EmailLayout: the HOS-2519 §5.1 layout, kept
 * as it was for the internal mails (HOS-2565 AC-4.1). The user variant is covered
 * by `email-layout-user.test.tsx`.
 */
describe('EmailLayout (staff variant)', () => {
    afterEach(() => {
        resetEmailAssets();
    });

    it('renders children inside one Spanish, light-only document', async () => {
        // Arrange & Act
        const { html } = await renderEmailBodies({
            attribution: TEST_ATTRIBUTION,
            react: (
                <EmailLayout
                    variant="staff"
                    previewText="Vista previa"
                >
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

    it('renders the isotipo image with explicit size and the wordmark as live text', async () => {
        // Arrange & Act
        const { html } = await renderEmailBodies({
            attribution: TEST_ATTRIBUTION,
            react: (
                <EmailLayout variant="staff">
                    <p>x</p>
                </EmailLayout>
            )
        });
        const img = html.match(/<img\b[^>]*>/)?.[0] ?? '';
        const header = html.slice(0, html.indexOf(TAGLINE));

        // Assert
        expect(EMAIL_ISOTIPO_URL).toBe('https://hospeda.com.ar/email/hospeda-isotipo@2x.png');
        expect(img).toContain(`src="${EMAIL_ISOTIPO_URL}"`);
        expect(img).toContain('alt=""');
        expect(img).toContain(`width="${EMAIL_ISOTIPO_WIDTH}"`);
        expect(img).toContain(`height="${EMAIL_ISOTIPO_HEIGHT}"`);
        expect(img).toContain('display:block');
        expect(header).toMatch(
            /<span style="[^"]*color:#003987[^"]*font-weight:800[^"]*">hospeda<\/span>/
        );
        expect(header).toContain('vertical-align:middle');
        expect(header).toContain('role="img"');
        expect(header).toContain('aria-label="Hospeda"');
        expect(html).toContain(TAGLINE);
        expect(html).not.toContain('hospeda-logo@2x.png');
    });

    it('omits the preheader when previewText is not set', async () => {
        // Arrange & Act
        const withPreview = await renderEmailBodies({
            attribution: TEST_ATTRIBUTION,
            react: (
                <EmailLayout
                    variant="staff"
                    previewText="Preheader único"
                >
                    <p>x</p>
                </EmailLayout>
            )
        });
        const withoutPreview = await renderEmailBodies({
            attribution: TEST_ATTRIBUTION,
            react: (
                <EmailLayout variant="staff">
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
            attribution: TEST_ATTRIBUTION,
            react: (
                <EmailLayout variant="staff">
                    <p>x</p>
                </EmailLayout>
            )
        });

        // Assert
        expect(html).toContain(FOOTER_BRAND_LINE);
        expect(html.replace(/\s+/g, ' ')).toContain(FOOTER_DESCRIPTION);
        // Attribution decorates the home link (HOS-2359); the base URL is unchanged.
        expect(html).toContain(`href="${EMAIL_PUBLIC_SITE_URL}?utm_source=email`);
        expect(html).toContain('hospeda.com.ar</a>');
    });

    it('defaults to footerLink none (no preferences link)', async () => {
        // Arrange & Act
        const { html } = await renderEmailBodies({
            attribution: TEST_ATTRIBUTION,
            react: (
                <EmailLayout variant="staff">
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
            attribution: TEST_ATTRIBUTION,
            react: (
                <EmailLayout
                    variant="staff"
                    footerLink="preferences"
                >
                    <p>x</p>
                </EmailLayout>
            )
        });

        // Assert
        expect(EMAIL_PREFERENCES_URL).toBe('https://hospeda.com.ar/es/mi-cuenta/preferencias/');
        expect(html).toMatch(
            /<a href="https:\/\/hospeda\.com\.ar\/es\/mi-cuenta\/preferencias\/\?utm_source=email[^"]*utm_content=preferences"[^>]*>Administrar preferencias de notificaciones<\/a>/
        );
        expect(html).not.toContain('{{');
        expect(html).not.toContain('unsubscribe_url');
    });

    it('uses only email-safe inline CSS', async () => {
        // Arrange & Act
        const { html } = await renderEmailBodies({
            attribution: TEST_ATTRIBUTION,
            react: (
                <EmailLayout
                    variant="staff"
                    footerLink="preferences"
                >
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

    it('caps the card at 600px in Outlook desktop and pads on table cells (R-2)', async () => {
        // Arrange & Act
        const { html, text } = await renderEmailBodies({
            attribution: TEST_ATTRIBUTION,
            react: (
                <EmailLayout variant="staff">
                    <p>x</p>
                </EmailLayout>
            )
        });

        // Assert
        expect(html).toContain(
            '<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->'
        );
        expect(html).toContain('<!--[if mso]></td></tr></table><![endif]-->');
        expect(html.indexOf('<!--[if mso]><table')).toBeLessThan(html.indexOf('max-width:600px'));
        expect(html.lastIndexOf('<!--[if mso]></td>')).toBeGreaterThan(
            html.indexOf('hospeda.com.ar</a>')
        );
        expect(html).toMatch(/<td[^>]*style="[^"]*padding:32px 24px/);
        expect(html).toMatch(/<td[^>]*style="[^"]*border-bottom:4px solid #3885f9/);
        expect(text).not.toContain('[if mso]');
    });

    it('keeps the logo URL and tagline out of the text part (AC-3.2)', async () => {
        // Arrange & Act
        const { text } = await renderEmailBodies({
            attribution: TEST_ATTRIBUTION,
            react: (
                <EmailLayout
                    variant="staff"
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
        expect(text).not.toContain(EMAIL_ISOTIPO_URL);
        expect(text.replace(FOOTER_BRAND_LINE, '')).not.toContain('Turismo en el Litoral');
        expect(text.replace(FOOTER_BRAND_LINE, '').toLowerCase()).not.toContain('hospeda -');
        expect(text.split('\n').some((line) => line.trim() === 'hospeda')).toBe(false);
    });

    describe('isotipo origin (HOS-2540)', () => {
        const render = async () =>
            renderEmailBodies({
                attribution: TEST_ATTRIBUTION,
                react: (
                    <EmailLayout
                        variant="staff"
                        footerLink="preferences"
                    >
                        <p>x</p>
                    </EmailLayout>
                )
            });

        it('uses the production isotipo URL by default', async () => {
            // Act
            const { html } = await render();

            // Assert
            expect(html).toContain('src="https://hospeda.com.ar/email/hospeda-isotipo@2x.png"');
        });

        it('follows the configured origin and strips a trailing slash', async () => {
            // Arrange
            configureEmailAssets({ siteUrl: 'https://staging.hospeda.com.ar/' });

            // Act
            const { html, text } = await render();

            // Assert
            expect(html).toContain(
                'src="https://staging.hospeda.com.ar/email/hospeda-isotipo@2x.png"'
            );
            expect(html).not.toContain('src="https://hospeda.com.ar/email/');
            expect(text).not.toContain('hospeda-isotipo');
        });

        it('keeps the footer and preferences links on production', async () => {
            // Arrange
            configureEmailAssets({ siteUrl: 'https://staging.hospeda.com.ar' });

            // Act
            const { html } = await render();

            // Assert
            expect(html).toContain('href="https://hospeda.com.ar?utm_source=email');
            expect(html).toContain(`href="${EMAIL_PREFERENCES_URL}?utm_source=email`);
            expect(EMAIL_ISOTIPO_URL).toBe('https://hospeda.com.ar/email/hospeda-isotipo@2x.png');
        });

        it.each([
            '',
            '   ',
            'not a url',
            '/relative/path',
            'ftp://hospeda.com.ar',
            'javascript:alert(1)'
        ])('throws TypeError for invalid siteUrl %j', (siteUrl) => {
            // Act & Assert
            expect(() => configureEmailAssets({ siteUrl })).toThrow(TypeError);
        });

        it('throws TypeError for a non-string siteUrl', () => {
            // Act & Assert
            // @ts-expect-error Testing runtime validation
            expect(() => configureEmailAssets({ siteUrl: 123 })).toThrow(TypeError);
        });

        it('keeps the previous origin when configuration is rejected', async () => {
            // Arrange
            configureEmailAssets({ siteUrl: 'https://staging.hospeda.com.ar' });

            // Act
            expect(() => configureEmailAssets({ siteUrl: 'nope' })).toThrow(TypeError);
            const { html } = await render();

            // Assert
            expect(html).toContain('src="https://staging.hospeda.com.ar/email/');
        });

        it('restores the production default after reset', async () => {
            // Arrange
            configureEmailAssets({ siteUrl: 'https://staging.hospeda.com.ar' });

            // Act
            resetEmailAssets();
            const { html } = await render();

            // Assert
            expect(html).toContain('src="https://hospeda.com.ar/email/hospeda-isotipo@2x.png"');
        });
    });
    describe('button media rule (HOS-2565 AC-2.6)', () => {
        it('should emit exactly one <style> whose content is the single .hospeda-btn media rule', async () => {
            // Arrange & Act
            const { html } = await renderEmailBodies({
                attribution: TEST_ATTRIBUTION,
                react: (
                    <EmailLayout variant="staff">
                        <p>x</p>
                    </EmailLayout>
                )
            });
            const styleBlocks = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)];

            // Assert
            expect(styleBlocks).toHaveLength(1);
            expect(styleBlocks[0]?.[1]).toBe(EMAIL_BUTTON_MEDIA_RULE);
            expect(EMAIL_BUTTON_MEDIA_RULE).toContain('max-width:480px');
            expect(EMAIL_BUTTON_MEDIA_RULE).toContain('.hospeda-btn{display:block !important;');
        });

        it('should keep the <style> out of the text part', async () => {
            // Arrange & Act
            const { text } = await renderEmailBodies({
                attribution: TEST_ATTRIBUTION,
                react: (
                    <EmailLayout variant="staff">
                        <p>Contenido</p>
                    </EmailLayout>
                )
            });

            // Assert
            expect(text).not.toContain('hospeda-btn');
            expect(text).not.toContain('@media');
        });
    });
});
