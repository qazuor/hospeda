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
        const html =
            '<body><div>Outside the main landmark, long enough to matter</div>' +
            '<main><p>Inside main</p></main><div>Trailing outside</div></body>';

        const text = stripHtmlToParagraphText({ html, maxChars: 500 });

        expect(text).toBe('Inside main');
    });

    it('ignores a "<main" that only appears inside an inline script', () => {
        const html =
            '<body><script>var t = "<main>";</script><p>Real content</p><main><p>Scoped</p></main></body>';

        const text = stripHtmlToParagraphText({ html, maxChars: 500 });

        expect(text).toBe('Scoped');
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
});
