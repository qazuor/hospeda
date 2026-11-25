import { afterEach, describe, expect, it } from 'vitest';
import { applyEmailAttribution, type EmailAttribution } from '../src/attribution.js';
import { configureEmailAssets, resetEmailAssets } from '../src/email-assets.js';

const TRANSACTIONAL: EmailAttribution = {
    medium: 'transactional',
    templateKey: 'auth.reset-password'
};

const UTM_TX = 'utm_source=email&amp;utm_medium=transactional&amp;utm_campaign=auth-reset-password';

function doc(body: string): string {
    return `<!DOCTYPE html><html><head></head><body>${body}</body></html>`;
}

describe('applyEmailAttribution', () => {
    afterEach(() => {
        resetEmailAssets();
    });

    describe('links', () => {
        it('decorates own-origin links with the layout slot, the CTA slot or body-link', () => {
            // Arrange
            const html = doc(
                '<a href="https://hospeda.com.ar" data-layout-link="home">h</a>' +
                    '<a href="https://hospeda.com.ar/es/mi-cuenta/" data-utm-content="cta">c</a>' +
                    '<a href="https://staging.hospeda.com.ar/es/x/">b</a>'
            );

            // Act
            const result = applyEmailAttribution({ html, attribution: TRANSACTIONAL });

            // Assert
            expect(result.html).toContain(
                `<a href="https://hospeda.com.ar?${UTM_TX}&amp;utm_content=home" data-layout-link="home">`
            );
            expect(result.html).toContain(
                `<a href="https://hospeda.com.ar/es/mi-cuenta/?${UTM_TX}&amp;utm_content=cta" data-utm-content="cta">`
            );
            expect(result.html).toContain(
                `<a href="https://staging.hospeda.com.ar/es/x/?${UTM_TX}&amp;utm_content=body-link">`
            );
        });

        it('round-trips &amp; in an existing query', () => {
            const html = doc('<a href="https://hospeda.com.ar/es/x/?a=1&amp;b=2">x</a>');

            const result = applyEmailAttribution({ html, attribution: TRANSACTIONAL });

            expect(result.html).toContain(
                `href="https://hospeda.com.ar/es/x/?a=1&amp;b=2&amp;${UTM_TX}&amp;utm_content=body-link"`
            );
        });

        it('leaves mailto, tel, anchors, API, admin and external links byte-identical', () => {
            const links =
                '<a href="mailto:hola@hospeda.com.ar">m</a>' +
                '<a href="tel:+5493442">t</a>' +
                '<a href="#top">a</a>' +
                '<a href="https://api.hospeda.com.ar/api/auth/reset?token=a&amp;cb=https%3A%2F%2Fx">r</a>' +
                '<a href="https://admin.hospeda.com.ar/">ad</a>' +
                '<a href="https://example.com/?q=1">e</a>';
            const html = doc(links);

            const result = applyEmailAttribution({
                html,
                attribution: { ...TRANSACTIONAL }
            });

            expect(result.html).toBe(html);
        });

        it('never overwrites a link that already carries UTMs', () => {
            const html = doc('<a href="https://hospeda.com.ar/?utm_source=brevo">x</a>');

            const result = applyEmailAttribution({
                html,
                attribution: { ...TRANSACTIONAL }
            });

            expect(result.html).toBe(html);
        });

        it('uses the campaign slug and medium for a newsletter', () => {
            const html = doc('<a href="https://hospeda.com.ar/es/x/">x</a>');

            const result = applyEmailAttribution({
                html,
                attribution: { medium: 'campaign', campaignSlug: 'otono-0f3a9c2e' }
            });

            expect(result.html).toContain(
                'href="https://hospeda.com.ar/es/x/?utm_source=email&amp;utm_medium=campaign&amp;utm_campaign=otono-0f3a9c2e&amp;utm_content=body-link"'
            );
        });

        it('treats the configured site origin as own', () => {
            configureEmailAssets({ siteUrl: 'http://localhost:4321' });
            const html = doc('<a href="http://localhost:4321/es/">x</a>');

            const result = applyEmailAttribution({
                html,
                attribution: { ...TRANSACTIONAL }
            });

            expect(result.html).toContain('http://localhost:4321/es/?utm_source=email');
        });
    });

    describe('text part', () => {
        it('replaces every recorded href, longest first, without touching other URLs', () => {
            const html = doc(
                '<a href="https://hospeda.com.ar" data-layout-link="home">h</a>' +
                    '<a href="https://hospeda.com.ar/es/mi-cuenta/">c</a>'
            );
            const text =
                'Ir [https://hospeda.com.ar/es/mi-cuenta/]\nhospeda.com.ar [https://hospeda.com.ar]\nOtro https://hospeda.com.ar/es/otro/';

            const result = applyEmailAttribution({
                html,
                text,
                attribution: { ...TRANSACTIONAL }
            });

            const plain = UTM_TX.replaceAll('&amp;', '&');
            expect(result.text).toBe(
                `Ir [https://hospeda.com.ar/es/mi-cuenta/?${plain}&utm_content=body-link]\n` +
                    `hospeda.com.ar [https://hospeda.com.ar?${plain}&utm_content=home]\n` +
                    'Otro https://hospeda.com.ar/es/otro/'
            );
        });

        it('decorates a URL followed by sentence punctuation without absorbing it', () => {
            // Arrange
            const html = doc('<a href="https://hospeda.com.ar/x">x</a>');
            const plain = UTM_TX.replaceAll('&amp;', '&');
            const suffix = `?${plain}&utm_content=body-link`;

            // Act
            const result = applyEmailAttribution({
                html,
                text: 'Mira https://hospeda.com.ar/x. Y https://hospeda.com.ar/x, o (https://hospeda.com.ar/x)!',
                attribution: { ...TRANSACTIONAL }
            });

            // Assert
            expect(result.text).toBe(
                `Mira https://hospeda.com.ar/x${suffix}. Y https://hospeda.com.ar/x${suffix}, o (https://hospeda.com.ar/x${suffix})!`
            );
        });

        it('does not decorate a longer URL that merely starts with a known one', () => {
            const html = doc('<a href="https://hospeda.com.ar/x">x</a>');

            const result = applyEmailAttribution({
                html,
                text: 'https://hospeda.com.ar/x.html',
                attribution: { ...TRANSACTIONAL }
            });

            expect(result.text).toBe('https://hospeda.com.ar/x.html');
        });

        it('replaces a decoded href that had &amp; in the HTML', () => {
            const html = doc('<a href="https://hospeda.com.ar/es/x/?a=1&amp;b=2">x</a>');

            const result = applyEmailAttribution({
                html,
                text: 'x [https://hospeda.com.ar/es/x/?a=1&b=2]',
                attribution: { ...TRANSACTIONAL }
            });

            expect(result.text).toContain('?a=1&b=2&utm_source=email&utm_medium=transactional');
        });

        it('omits text from the result when none is given', () => {
            const result = applyEmailAttribution({ html: doc(''), attribution: TRANSACTIONAL });

            expect(result.text).toBeUndefined();
        });
    });

    describe('no open pixel (HOS-2583, AC-2)', () => {
        it.each([
            ['transactional', TRANSACTIONAL],
            ['campaign', { medium: 'campaign', campaignSlug: 'otono-0f3a9c2e' } as EmailAttribution]
        ])('never inserts an image for a %s email, even with an https Umami origin', (_kind, attribution) => {
            const result = applyEmailAttribution({
                html: doc('<p>hola</p><a href="https://hospeda.com.ar/es/">x</a>'),
                text: 'hola',
                attribution
            });

            expect(result.html).not.toContain('<img');
            expect(result.html).not.toContain('/p/');
            expect(result.html).toContain('utm_source=email');
            expect(result.text).toBe('hola');
        });

        it('leaves a document without links byte-identical', () => {
            const result = applyEmailAttribution({
                html: '<p>x</p>',
                attribution: TRANSACTIONAL
            });

            expect(result.html).toBe('<p>x</p>');
        });
    });
});
