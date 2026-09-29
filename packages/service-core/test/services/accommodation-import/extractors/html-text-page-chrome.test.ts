/**
 * Regression tests for HOS-1219: the importer let the page chrome (skip link,
 * site header, language/theme switchers) open the imported description and
 * summary even after HOS-1029 fixed the body scope.
 *
 * The fixture is real markup served by the platform's own accommodation page
 * (trimmed): a loose `<a class="skip-to-content">` BEFORE the `<header>`, the
 * header itself, then `<main>` with gallery, quick-facts pills and the prose.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { resolveImportedSummary } from '../../../../src/services/accommodation-import/adapters/imported-text.js';
import { stripHtmlToParagraphText } from '../../../../src/services/accommodation-import/extractors/html-text.js';

const FIXTURE = readFileSync(
    new URL('./fixtures/hospeda-listing-page.html', import.meta.url),
    'utf8'
);

const CHROME_MARKERS = ['Saltar al contenido', 'Iniciar sesión', 'Idioma', 'Tema'] as const;

describe('stripHtmlToParagraphText — page chrome (HOS-1219)', () => {
    it('keeps the skip link, header and switchers out of the extracted text', () => {
        // Arrange / Act
        const text = stripHtmlToParagraphText({ html: FIXTURE, maxChars: 20_000 });

        // Assert
        for (const marker of CHROME_MARKERS) {
            expect(text).not.toContain(marker);
        }
        expect(text).toContain('Camping Río Vida es un paraíso natural');
    });

    it('keeps the chrome out of the summary derived from the description', () => {
        // Arrange
        const text = stripHtmlToParagraphText({ html: FIXTURE, maxChars: 20_000 });

        // Act
        const summary = resolveImportedSummary({ descriptionText: text });

        // Assert
        expect(summary).not.toBeNull();
        for (const marker of CHROME_MARKERS) {
            expect(summary).not.toContain(marker);
        }
        expect(summary).toContain('Camping Río Vida es un paraíso natural');
    });

    it('scopes to <main> when the page has one', () => {
        const inside = 'Inside main, the real listing description. '.repeat(4).trim();
        const html =
            '<body><div>Outside the main landmark, long enough to matter</div>' +
            `<main><p>${inside}</p></main><div>Trailing outside</div></body>`;

        const text = stripHtmlToParagraphText({ html, maxChars: 500 });

        expect(text).toBe(inside);
    });

    it('ignores a "<main" that only appears inside an inline script', () => {
        const scoped = 'Scoped listing description, long enough. '.repeat(4).trim();
        const html = `<body><script>var t = "<main>";</script><p>Real content</p><main><p>${scoped}</p></main></body>`;

        const text = stripHtmlToParagraphText({ html, maxChars: 500 });

        expect(text).toBe(scoped);
    });

    it('falls back to the whole body when there is no <main>', () => {
        const html = '<body><p>Uno</p><p>Dos</p></body>';

        const text = stripHtmlToParagraphText({ html, maxChars: 500 });

        expect(text).toBe('Uno\n\nDos');
    });

    it('drops a skip-to-content link on a page with no <main> to scope to', () => {
        const html =
            '<body><a href="#c" class="skip-link">Saltar al contenido</a>' +
            '<p>Prose that belongs to the listing.</p></body>';

        const text = stripHtmlToParagraphText({ html, maxChars: 500 });

        expect(text).toBe('Prose that belongs to the listing.');
    });

    it('does not eat a normal link whose text merely mentions skipping', () => {
        const html = '<body><p>Read <a href="/x">why guests skip breakfast</a> here.</p></body>';

        const text = stripHtmlToParagraphText({ html, maxChars: 500 });

        expect(text).toContain('why guests skip breakfast');
    });

    describe('<main> selection guards', () => {
        const PROSE =
            'Casa de campo con pileta, parrilla y amplio jardin, a diez minutos del rio. ' +
            'Ideal para familias que buscan descanso, con cinco dormitorios y cochera cubierta.';

        it('ignores a <main> that lives inside <noscript>', () => {
            const html = `<body><noscript><main>Activa JavaScript</main></noscript><div>${PROSE}</div></body>`;

            const text = stripHtmlToParagraphText({ html, maxChars: 2000 });

            expect(text).toContain('Casa de campo');
            expect(text).not.toContain('Activa JavaScript');
        });

        it('ignores a <main> that lives inside <template>', () => {
            const html = `<body><template><main>tpl</main></template><main><p>${PROSE}</p></main></body>`;

            const text = stripHtmlToParagraphText({ html, maxChars: 2000 });

            expect(text).toContain('Casa de campo');
            expect(text).not.toContain('tpl');
        });

        it('skips a <main hidden> and takes the visible one', () => {
            const html = `<body><main hidden><p>Hidden shell</p></main><main><p>${PROSE}</p></main></body>`;

            const text = stripHtmlToParagraphText({ html, maxChars: 2000 });

            expect(text).toContain('Casa de campo');
            expect(text).not.toContain('Hidden shell');
        });

        it('falls back to the body when <main> is empty and the content sits outside it', () => {
            const html = `<body><main id="app"></main><div>${PROSE}</div></body>`;

            const text = stripHtmlToParagraphText({ html, maxChars: 2000 });

            expect(text).toContain('Casa de campo');
        });

        it('falls back to the body when the description sits in a sibling section outside <main>', () => {
            const html = `<body><main><p>Short</p></main><section><p>${PROSE}</p></section></body>`;

            const text = stripHtmlToParagraphText({ html, maxChars: 2000 });

            expect(text).toContain('Casa de campo');
        });

        it('does not treat a custom element <main-nav> as <main>', () => {
            const html = `<body><main-nav>Menu</main-nav><main><p>${PROSE}</p></main></body>`;

            const text = stripHtmlToParagraphText({ html, maxChars: 2000 });

            expect(text).toContain('Casa de campo');
            expect(text).not.toContain('Menu');
        });
    });

    describe('skip-link matching', () => {
        it.each([
            ['class="skipper-boat"', '<a class="skipper-boat" href="/b">Alquiler de botes</a>'],
            ['id="skipass-info"', '<a id="skipass-info" href="/s">Info de pases</a>'],
            ['data-id="skip"', '<a data-id="skip" href="/d">Dato util</a>']
        ])('keeps a link with %s', (_label, link) => {
            const html = `<body>${link}<p>Prose that belongs to the listing.</p></body>`;

            const text = stripHtmlToParagraphText({ html, maxChars: 500 });

            expect(text).toMatch(/Alquiler de botes|Info de pases|Dato util/);
        });

        it('does not eat past an unclosed skip link into the next link', () => {
            const html =
                '<body><a class="skip-link" href="#c">Saltar<p>Real prose here.</p>' +
                '<a href="/x">Other</a></body>';

            const text = stripHtmlToParagraphText({ html, maxChars: 500 });

            expect(text).toContain('Real prose here.');
        });

        it('does not strip a skip-named link inside <main>', () => {
            const long = 'Texto largo de la descripcion real del alojamiento. '.repeat(4);
            const html = `<body><main><p>${long}</p><a class="skip-link" href="#">Texto del enlace</a></main></body>`;

            const text = stripHtmlToParagraphText({ html, maxChars: 2000 });

            expect(text).toContain('Texto del enlace');
        });
    });
});
