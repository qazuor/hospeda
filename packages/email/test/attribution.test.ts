import { afterEach, describe, expect, it } from 'vitest';
import {
    applyEmailAttribution,
    buildEmailPixelUrl,
    type EmailAttribution,
    UMAMI_PIXEL_PATH
} from '../src/attribution.js';
import { configureEmailAssets, resetEmailAssets } from '../src/email-assets.js';

const TRANSACTIONAL: EmailAttribution = {
    medium: 'transactional',
    templateKey: 'auth.reset-password',
    includePixel: true
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
                attribution: { ...TRANSACTIONAL, includePixel: false }
            });

            expect(result.html).toBe(html);
        });

        it('never overwrites a link that already carries UTMs', () => {
            const html = doc('<a href="https://hospeda.com.ar/?utm_source=brevo">x</a>');

            const result = applyEmailAttribution({
                html,
                attribution: { ...TRANSACTIONAL, includePixel: false }
            });

            expect(result.html).toBe(html);
        });

        it('uses the campaign slug and medium for a newsletter', () => {
            const html = doc('<a href="https://hospeda.com.ar/es/x/">x</a>');

            const result = applyEmailAttribution({
                html,
                attribution: { medium: 'campaign', campaignSlug: 'otono-0f3a9c2e', pixelSlug: null }
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
                attribution: { ...TRANSACTIONAL, includePixel: false }
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
                attribution: { ...TRANSACTIONAL, includePixel: false }
            });

            const plain = UTM_TX.replaceAll('&amp;', '&');
            expect(result.text).toBe(
                `Ir [https://hospeda.com.ar/es/mi-cuenta/?${plain}&utm_content=body-link]\n` +
                    `hospeda.com.ar [https://hospeda.com.ar?${plain}&utm_content=home]\n` +
                    'Otro https://hospeda.com.ar/es/otro/'
            );
        });

        it('replaces a decoded href that had &amp; in the HTML', () => {
            const html = doc('<a href="https://hospeda.com.ar/es/x/?a=1&amp;b=2">x</a>');

            const result = applyEmailAttribution({
                html,
                text: 'x [https://hospeda.com.ar/es/x/?a=1&b=2]',
                attribution: { ...TRANSACTIONAL, includePixel: false }
            });

            expect(result.text).toContain('?a=1&b=2&utm_source=email&utm_medium=transactional');
        });

        it('omits text from the result when none is given', () => {
            const result = applyEmailAttribution({ html: doc(''), attribution: TRANSACTIONAL });

            expect(result.text).toBeUndefined();
        });
    });

    describe('pixel', () => {
        it('inserts exactly one pixel before </body> when the pixel origin is https (AC-2)', () => {
            configureEmailAssets({
                siteUrl: 'https://hospeda.com.ar',
                pixelBaseUrl: 'https://pulso.hospeda.com.ar/'
            });

            const result = applyEmailAttribution({
                html: doc('<p>hola</p>'),
                text: 'hola',
                attribution: TRANSACTIONAL
            });

            const pixel =
                '<img src="https://pulso.hospeda.com.ar/p/email-auth-reset-password" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0" />';
            expect(result.html).toBe(doc(`<p>hola</p>${pixel}`));
            expect(result.html.split('/p/').length - 1).toBe(1);
            expect(result.text).toBe('hola');
        });

        it('builds the pixel URL with no query string', () => {
            expect(UMAMI_PIXEL_PATH).toBe('/p');
            expect(
                buildEmailPixelUrl({ pixelBaseUrl: 'https://pulso.hospeda.com.ar', slug: 'x' })
            ).toBe('https://pulso.hospeda.com.ar/p/x');
        });

        it('appends the pixel when there is no </body>', () => {
            configureEmailAssets({
                siteUrl: 'https://hospeda.com.ar',
                pixelBaseUrl: 'https://pulso.hospeda.com.ar'
            });

            const result = applyEmailAttribution({ html: '<p>x</p>', attribution: TRANSACTIONAL });

            expect(
                result.html.startsWith('<p>x</p><img src="https://pulso.hospeda.com.ar/p/')
            ).toBe(true);
        });

        it('uses the campaign pixel slug and skips a null one', () => {
            configureEmailAssets({
                siteUrl: 'https://hospeda.com.ar',
                pixelBaseUrl: 'https://pulso.hospeda.com.ar'
            });

            const withPixel = applyEmailAttribution({
                html: doc(''),
                attribution: {
                    medium: 'campaign',
                    campaignSlug: 'otono-0f3a9c2e',
                    pixelSlug: 'newsletter-otono-0f3a9c2e'
                }
            });
            const withoutPixel = applyEmailAttribution({
                html: doc(''),
                attribution: { medium: 'campaign', campaignSlug: 'otono-0f3a9c2e', pixelSlug: null }
            });

            expect(withPixel.html).toContain(
                'src="https://pulso.hospeda.com.ar/p/newsletter-otono-0f3a9c2e"'
            );
            expect(withoutPixel.html).toBe(doc(''));
        });

        it('renders no pixel when includePixel is false (admin preview, AC-5)', () => {
            configureEmailAssets({
                siteUrl: 'https://hospeda.com.ar',
                pixelBaseUrl: 'https://pulso.hospeda.com.ar'
            });

            const result = applyEmailAttribution({
                html: doc(''),
                attribution: { ...TRANSACTIONAL, includePixel: false }
            });

            expect(result.html).toBe(doc(''));
        });

        it.each([
            undefined,
            'http://umami:3000',
            'not a url'
        ])('renders UTMs and no pixel when the pixel origin is %s (AC-4)', (pixelBaseUrl) => {
            configureEmailAssets({
                siteUrl: 'https://hospeda.com.ar',
                ...(pixelBaseUrl === undefined ? {} : { pixelBaseUrl })
            });

            const result = applyEmailAttribution({
                html: doc('<a href="https://hospeda.com.ar/es/">x</a>'),
                attribution: TRANSACTIONAL
            });

            expect(result.html).not.toContain('<img');
            expect(result.html).toContain('utm_source=email');
        });

        it('is identical for two renders of the same template (AC-3)', () => {
            configureEmailAssets({
                siteUrl: 'https://hospeda.com.ar',
                pixelBaseUrl: 'https://pulso.hospeda.com.ar'
            });

            const a = applyEmailAttribution({
                html: doc('<p>Hola Ana</p>'),
                attribution: TRANSACTIONAL
            });
            const b = applyEmailAttribution({
                html: doc('<p>Hola Juan</p>'),
                attribution: TRANSACTIONAL
            });

            const src = (h: string) => /<img src="([^"]+)"/.exec(h)?.[1];
            expect(src(a.html)).toBeDefined();
            expect(src(a.html)).toBe(src(b.html));
        });
    });
});
