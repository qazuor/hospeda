/**
 * Unit tests for the HTML → plain-text converters (HOS-799).
 *
 * AAA pattern throughout.
 *
 * The point of these tests is the DIFFERENCE between the two converters:
 * `stripHtmlToText` must keep flattening everything (the AI Strategy-B prompt
 * depends on it), while `stripHtmlToParagraphText` must preserve paragraph
 * structure (the `description` candidate depends on it).
 */

import { describe, expect, it } from 'vitest';

import {
    decodeHtmlEntities,
    stripHtmlToParagraphText,
    stripHtmlToText
} from '../../../../src/services/accommodation-import/extractors/html-text.js';

describe('stripHtmlToParagraphText', () => {
    it('preserves a paragraph break between two <p> elements', () => {
        // Arrange
        const html = '<html><body><p>Primera parte.</p><p>Segunda parte.</p></body></html>';

        // Act
        const result = stripHtmlToParagraphText({ html, maxChars: 1000 });

        // Assert — this is the HOS-799 symptom: without the block-boundary pass
        // the two sentences weld into "Primera parte.Segunda parte.".
        expect(result).toBe('Primera parte.\n\nSegunda parte.');
        expect(result).toContain('\n');
    });

    it('yields the same paragraphs whether the source markup is minified or indented', () => {
        // Arrange — identical content, different source formatting.
        const minified = '<html><body><p>Uno.</p><p>Dos.</p></body></html>';
        const indented = `<html>
  <body>
    <p>Uno.</p>
    <p>Dos.</p>
  </body>
</html>`;

        // Act
        const fromMinified = stripHtmlToParagraphText({ html: minified, maxChars: 1000 });
        const fromIndented = stripHtmlToParagraphText({ html: indented, maxChars: 1000 });

        // Assert — the source's own indentation must not decide whether the
        // host gets paragraphs or single line breaks.
        expect(fromMinified).toBe(fromIndented);
        expect(fromMinified).toBe('Uno.\n\nDos.');
    });

    it('turns <br> into a line break', () => {
        // Arrange
        const html = '<html><body><div>Uno<br>Dos<br/>Tres</div></body></html>';

        // Act
        const result = stripHtmlToParagraphText({ html, maxChars: 1000 });

        // Assert
        expect(result).toBe('Uno\nDos\nTres');
    });

    it('caps consecutive breaks at a single blank line', () => {
        // Arrange
        const html = '<html><body><p>Uno</p><br><br><br><p>Dos</p></body></html>';

        // Act
        const result = stripHtmlToParagraphText({ html, maxChars: 1000 });

        // Assert
        expect(result).toBe('Uno\n\nDos');
    });

    it('scopes extraction to <body>, so <title> never leaks into the content', () => {
        // Arrange
        const html =
            '<html><head><title>Titulo SEO de la pagina</title></head>' +
            '<body><p>El contenido real.</p></body></html>';

        // Act
        const result = stripHtmlToParagraphText({ html, maxChars: 1000 });

        // Assert — a leaked <title> is exactly what let a scrap of chrome clear
        // the description minimum on a thin page.
        expect(result).toBe('El contenido real.');
        expect(result).not.toContain('Titulo SEO');
    });

    it('does not anchor the body-scope on a <head> comment that mentions "<body>" (HOS-1029)', () => {
        // Arrange — the exact case measured in staging: a <head> comment whose
        // prose mentions "<body>" AND contains a stray ">" inside its text.
        // Before the fix, BODY_CONTENT_RE matched the literal "<body>" INSIDE
        // this comment (not the real <body> tag below), so extraction started
        // inside the head, and the generic tag-strip regex — which stops at
        // the first ">" — left the comment's own text, including the closing
        // "-->", as literal output.
        const html =
            '<html><head>' +
            '<title>Casa Rio | Alquiler</title>' +
            '<!-- TICKET-1234: from <body> it would sit after the islands rendered ' +
            'above it, see also step > 2 in the runbook -->' +
            '</head>' +
            '<body><nav><a href="/">Inicio</a></nav>' +
            '<main><p>La casa tiene pileta y parrilla.</p></main>' +
            '</body></html>';

        // Act
        const result = stripHtmlToParagraphText({ html, maxChars: 1000 });

        // Assert — only the real body content survives.
        expect(result).toBe('La casa tiene pileta y parrilla.');
        expect(result).not.toContain('-->');
        expect(result).not.toContain('TICKET-1234');
        expect(result).not.toContain('runbook');
        expect(result).not.toContain('Casa Rio');
    });

    it('does not leak page chrome when the triggering head comment is absent (HOS-1029 control)', () => {
        // Arrange — same markup as the case above, MINUS the <head> comment,
        // to isolate whether the chrome leak was a side effect of the bad
        // body-scope anchor or a defect of PAGE_CHROME_RE itself.
        const html =
            '<html><head>' +
            '<title>Casa Rio | Alquiler</title>' +
            '</head>' +
            '<body><nav><a href="/">Inicio</a></nav>' +
            '<main><p>La casa tiene pileta y parrilla.</p></main>' +
            '</body></html>';

        // Act
        const result = stripHtmlToParagraphText({ html, maxChars: 1000 });

        // Assert — with the scope anchored correctly, the chrome filter alone
        // removes the <nav>. If this fails, PAGE_CHROME_RE has an independent
        // defect that the comment-stripping fix does not cover.
        expect(result).toBe('La casa tiene pileta y parrilla.');
        expect(result).not.toContain('Inicio');
    });

    it('strips <head> when the markup has no <body> element', () => {
        // Arrange
        const html = '<html><head><title>Titulo</title></head><p>Contenido suelto.</p></html>';

        // Act
        const result = stripHtmlToParagraphText({ html, maxChars: 1000 });

        // Assert
        expect(result).toBe('Contenido suelto.');
        expect(result).not.toContain('Titulo');
    });

    it('removes page chrome — nav, header, footer, aside and forms', () => {
        // Arrange
        const html =
            '<html><body>' +
            '<nav><a href="/">Inicio</a></nav>' +
            '<header>Menu principal</header>' +
            '<aside>Publicidad</aside>' +
            '<p>La casa tiene pileta.</p>' +
            '<form><button>Enviar</button></form>' +
            '<footer>Aceptar cookies</footer>' +
            '</body></html>';

        // Act
        const result = stripHtmlToParagraphText({ html, maxChars: 1000 });

        // Assert
        expect(result).toBe('La casa tiene pileta.');
        for (const junk of ['Inicio', 'Menu principal', 'Publicidad', 'Enviar', 'cookies']) {
            expect(result).not.toContain(junk);
        }
    });

    it('removes script and style content', () => {
        // Arrange
        const html =
            '<html><body><script>var secreto = 1;</script>' +
            '<style>.a{color:red}</style><p>Visible.</p></body></html>';

        // Act
        const result = stripHtmlToParagraphText({ html, maxChars: 1000 });

        // Assert
        expect(result).toBe('Visible.');
    });

    it('collapses spaces and tabs without touching the line breaks', () => {
        // Arrange
        const html = '<html><body><p>Mucho    espacio\t\taca</p><p>Y   aca</p></body></html>';

        // Act
        const result = stripHtmlToParagraphText({ html, maxChars: 1000 });

        // Assert
        expect(result).toBe('Mucho espacio aca\n\nY aca');
    });

    it('decodes common HTML entities', () => {
        // Arrange
        const html =
            '<html><body><p>Ma&amp;s &quot;citado&quot; &nbsp;y &lt;ok&gt;</p></body></html>';

        // Act
        const result = stripHtmlToParagraphText({ html, maxChars: 1000 });

        // Assert
        expect(result).toBe('Ma&s "citado" y <ok>');
    });

    it('truncates to maxChars', () => {
        // Arrange
        const html = '<html><body><p>abcdefghij</p></body></html>';

        // Act
        const result = stripHtmlToParagraphText({ html, maxChars: 4 });

        // Assert
        expect(result).toBe('abcd');
    });

    it('returns an empty string for empty input', () => {
        // Arrange / Act
        const result = stripHtmlToParagraphText({ html: '', maxChars: 1000 });

        // Assert
        expect(result).toBe('');
    });
});

describe('stripHtmlToText (unchanged flattening behaviour)', () => {
    it('flattens paragraph breaks into single spaces', () => {
        // Arrange
        const html = '<html><body><p>Primera parte.</p><p>Segunda parte.</p></body></html>';

        // Act
        const result = stripHtmlToText({ html, maxChars: 1000 });

        // Assert — the AI prompt path must keep collapsing everything.
        expect(result).toBe('Primera parte. Segunda parte.');
        expect(result).not.toContain('\n');
    });

    it('does not leak a comment containing ">" into the output (HOS-1029)', () => {
        // Arrange
        const html = '<html><body><!-- internal note: step > 2 --><p>Visible.</p></body></html>';

        // Act
        const result = stripHtmlToText({ html, maxChars: 1000 });

        // Assert
        expect(result).toBe('Visible.');
        expect(result).not.toContain('-->');
        expect(result).not.toContain('internal note');
    });
});

describe('decodeHtmlEntities', () => {
    it('decodes exactly one level, never double-decoding', () => {
        // Arrange
        const text = 'a &amp;lt; b';

        // Act
        const result = decodeHtmlEntities(text);

        // Assert — a chained replace would yield 'a < b' (the CodeQL finding).
        expect(result).toBe('a &lt; b');
    });
});
