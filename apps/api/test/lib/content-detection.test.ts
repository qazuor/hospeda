/**
 * Unit tests for `src/lib/content-detection.ts` (HOS-216).
 *
 * Covers:
 *  (a) the tightened unordered-list pattern no longer false-positives on a
 *      single plain-text bullet line, while still detecting real markdown
 *      (2+ consecutive bullet lines, and every other rich-content pattern).
 *  (c) `stripRichDescriptionSyntax` / `stripVideoEmbeds` neutralize only the
 *      gated syntax, leaving the surrounding plain text intact — the
 *      building blocks `gateRichDescription` / `gateVideoEmbed` use to avoid
 *      rejecting the whole PATCH request (see accommodation-entitlements.ts).
 */

import { describe, expect, it } from 'vitest';
import {
    containsRichDescription,
    containsVideoEmbed,
    stripRichDescriptionSyntax,
    stripVideoEmbeds
} from '../../src/lib/content-detection';

describe('containsRichDescription', () => {
    describe('HOS-216 regression: single-line bullets must NOT match', () => {
        it('does not match a single "- item" line (the reported false positive)', () => {
            expect(containsRichDescription('- WiFi incluido en todas las habitaciones')).toBe(
                false
            );
        });

        it('does not match a single "* item" line', () => {
            expect(containsRichDescription('* Pileta climatizada todo el año')).toBe(false);
        });

        it('does not match a single "+ item" line', () => {
            expect(containsRichDescription('+ Cochera cubierta')).toBe(false);
        });

        it('does not match a bullet line surrounded by unrelated plain text lines', () => {
            expect(
                containsRichDescription(
                    'Departamento a 2 cuadras de la playa.\n- WiFi\nApto para 4 personas.'
                )
            ).toBe(false);
        });

        it('does not match plain prose containing a lone hyphen mid-sentence', () => {
            expect(containsRichDescription('Departamento tipo duplex - dos plantas')).toBe(false);
        });
    });

    describe('genuine markdown lists (2+ consecutive bullet lines) still match', () => {
        it('matches two consecutive "-" bullet lines', () => {
            expect(containsRichDescription('- WiFi\n- Pileta')).toBe(true);
        });

        it('matches three consecutive "-" bullet lines with trailing prose', () => {
            expect(containsRichDescription('Amenities:\n- WiFi\n- Pileta\n- Estacionamiento')).toBe(
                true
            );
        });

        it('matches consecutive bullet lines using "*"', () => {
            expect(containsRichDescription('* WiFi\n* Pileta')).toBe(true);
        });

        it('matches consecutive bullet lines using "+"', () => {
            expect(containsRichDescription('+ WiFi\n+ Pileta')).toBe(true);
        });

        it('matches consecutive bullet lines using mixed markers', () => {
            expect(containsRichDescription('- WiFi\n* Pileta')).toBe(true);
        });
    });

    describe('bullet lines separated by blank lines still match (HOS-216 follow-up)', () => {
        it('matches two bullet lines separated by a single blank line', () => {
            expect(containsRichDescription('- WiFi\n\n- Pileta')).toBe(true);
        });

        it('matches three bullet lines separated by blank lines', () => {
            expect(containsRichDescription('- WiFi\n\n- Pileta\n\n- Coch')).toBe(true);
        });

        it('does not match a single bullet line with no second bullet anywhere', () => {
            expect(containsRichDescription('- WiFi')).toBe(false);
        });

        it('does not match plain prose with a hyphen mid-sentence', () => {
            expect(containsRichDescription('texto - guion en medio')).toBe(false);
        });
    });

    describe('other rich-content patterns (unchanged by HOS-216)', () => {
        it('matches bold (**text**)', () => {
            expect(containsRichDescription('Departamento **remodelado**')).toBe(true);
        });

        it('matches italic (*text*)', () => {
            expect(containsRichDescription('Vista *espectacular* al río')).toBe(true);
        });

        it('matches markdown links', () => {
            expect(containsRichDescription('Ver más en [nuestro sitio](https://example.com)')).toBe(
                true
            );
        });

        it('matches ATX headings', () => {
            expect(containsRichDescription('# Bienvenidos')).toBe(true);
        });

        it('matches inline code', () => {
            expect(containsRichDescription('Código de acceso: `1234`')).toBe(true);
        });

        it('returns false for plain prose with no markdown at all', () => {
            expect(
                containsRichDescription(
                    'Hermoso departamento con vista al río, a pasos de la playa. WiFi y pileta incluidos.'
                )
            ).toBe(false);
        });
    });
});

describe('stripRichDescriptionSyntax', () => {
    it('removes bold markers, keeping the text', () => {
        expect(stripRichDescriptionSyntax('Departamento **remodelado** este año')).toBe(
            'Departamento remodelado este año'
        );
    });

    it('removes italic markers, keeping the text', () => {
        expect(stripRichDescriptionSyntax('Vista *espectacular* al río')).toBe(
            'Vista espectacular al río'
        );
    });

    it('replaces markdown links with their link text only', () => {
        expect(stripRichDescriptionSyntax('Ver [el mapa](https://example.com/map)')).toBe(
            'Ver el mapa'
        );
    });

    it('removes ATX heading markers', () => {
        expect(stripRichDescriptionSyntax('# Bienvenidos\nTexto normal')).toBe(
            'Bienvenidos\nTexto normal'
        );
    });

    it('removes bullet markers from a real list, keeping each item as plain text', () => {
        expect(stripRichDescriptionSyntax('- WiFi\n- Pileta')).toBe('WiFi\nPileta');
    });

    it('removes inline code backticks, keeping the code text', () => {
        expect(stripRichDescriptionSyntax('Código: `1234`')).toBe('Código: 1234');
    });

    it('removes __bold__ markers, keeping the text', () => {
        // Arrange
        const value = 'Departamento __remodelado__';

        // Act
        const result = stripRichDescriptionSyntax(value);

        // Assert
        expect(result).toBe('Departamento remodelado');
    });

    it('removes _italic_ underscore markers, keeping the text (HOS-2678)', () => {
        expect(stripRichDescriptionSyntax('Vista _espectacular_ al río')).toBe(
            'Vista espectacular al río'
        );
        expect(stripRichDescriptionSyntax('_x_')).toBe('x');
        expect(stripRichDescriptionSyntax('_foo_bar_')).toBe('foo_bar');
        expect(stripRichDescriptionSyntax('_una\nlinea_')).toBe('una\nlinea');
        expect(stripRichDescriptionSyntax('B _guion bajo cursiva_ C __doble__ D')).toBe(
            'B guion bajo cursiva C doble D'
        );
        expect(stripRichDescriptionSyntax('Hola _mundo_, ¿qué tal? (_ok_)')).toBe(
            'Hola mundo, ¿qué tal? (ok)'
        );
    });

    it.each([
        'usa snake_case_name en el código',
        'mail a juan_perez_gomez@example.com ahora',
        'https://example.com/a_b_c/file_name_v2.pdf',
        'a _ b _ c con espacios',
        'dos_ palabras _sueltas',
        '5_000_000 pesos',
        '_foo_bar sigue igual',
        'foo_bar_ baz sigue igual',
        '_foo\n\nbar_'
    ])('leaves intra-word and non-emphasis underscores intact: %s', (value) => {
        expect(stripRichDescriptionSyntax(value)).toBe(value);
    });

    it('removes ~~strikethrough~~ markers, keeping the text', () => {
        // Arrange
        const value = 'Precio ~~viejo~~ vigente';

        // Act
        const result = stripRichDescriptionSyntax(value);

        // Assert
        expect(result).toBe('Precio viejo vigente');
    });

    it('removes ordered-list markers, keeping each item as plain text', () => {
        // Arrange
        const value = '1. WiFi\n2) Pileta';

        // Act
        const result = stripRichDescriptionSyntax(value);

        // Assert
        expect(result).toBe('WiFi\nPileta');
    });

    it('removes blockquote markers, keeping the quoted text', () => {
        // Arrange
        const value = '> Cita importante\n> segunda línea';

        // Act
        const result = stripRichDescriptionSyntax(value);

        // Assert
        expect(result).toBe('Cita importante\nsegunda línea');
    });

    it('removes code fence lines, keeping the fenced content', () => {
        // Arrange
        const value = '```ts\nconst x = 1;\n```';

        // Act
        const result = stripRichDescriptionSyntax(value);

        // Assert
        expect(result).toBe('\nconst x = 1;\n');
    });

    it('removes HTML tags, keeping the inner text', () => {
        // Arrange
        const value = 'Bold y <b>html</b> y <a href="https://x.test">link</a>';

        // Act
        const result = stripRichDescriptionSyntax(value);

        // Assert
        expect(result).toBe('Bold y html y link');
    });

    it('keeps a bare less-than/greater-than comparison that is not an HTML tag', () => {
        // Arrange
        const value = 'Capacidad 2 < 4 personas y 6 > 5';

        // Act
        const result = stripRichDescriptionSyntax(value);

        // Assert
        expect(result).toBe(value);
    });

    describe('adversarial inputs (HOS-2209)', () => {
        const hasHtml = (v: string) => /<[a-zA-Z/!?]/.test(v);

        it.each([
            ['nested tag', '<<b>b>bold</b>'],
            ['script tag', 'hola <script>alert(1)</script> chau'],
            ['markdown inside a tag', '<b>**x**</b>'],
            ['tag hiding bold markers', '*<b>*x*</b>*'],
            ['doubly nested', '<<<i>i>i>x'],
            ['comment', 'a <!-- c --> b'],
            ['autolink', '<https://evil.test>'],
            ['unterminated tag', 'x <img src=x onerror=alert(1)'],
            ['doubled opener before a tag', '<<img src=x onerror=alert(1)>'],
            ['doubled opener before a comment', '<<!--'],
            ['long run of openers', `${'<'.repeat(40)}!-- ${'<'.repeat(40)}script>`],
            ['deeply nested tags', `${'<<b>'.repeat(200)}x${'b>'.repeat(200)}`]
        ])('leaves no HTML opener for %s', (_name, input) => {
            // Act
            const result = stripRichDescriptionSyntax(input);

            // Assert
            expect(hasHtml(result)).toBe(false);
        });

        it('unwraps a tag split by another tag', () => {
            expect(stripRichDescriptionSyntax('<<b>b>bold</b>')).toBe('bold');
        });

        it('keeps the alt text of an image and drops its URL', () => {
            expect(stripRichDescriptionSyntax('![vista](https://x.test/a.png)')).toBe('vista');
        });

        it('keeps the text of links, nested or reference style', () => {
            expect(stripRichDescriptionSyntax('[**a**](https://x.test)')).toBe('a');
            expect(stripRichDescriptionSyntax('[a][1]\n\n[1]: https://x.test')).toBe('a\n');
        });

        it('removes horizontal rules and setext underlines', () => {
            expect(stripRichDescriptionSyntax('Titulo\n=====\n---\n***')).toBe('Titulo\n\n\n');
        });

        it('keeps stripping past any fixed pass count (no half-cleaned output)', () => {
            // Arrange: nested links, each pass can only unwrap the innermost one.
            let input = 'a';
            for (let depth = 0; depth < 60; depth += 1) input = `[${input}](https://x.test)`;

            // Act
            const result = stripRichDescriptionSyntax(input);

            // Assert
            expect(result).toBe('a');
        });

        it('is stable: stripping the result changes nothing', () => {
            const once = stripRichDescriptionSyntax('<<b>b> **<i>*x*</i>** [a](u)');
            expect(stripRichDescriptionSyntax(once)).toBe(once);
        });
    });

    it('leaves plain prose untouched', () => {
        const plain = 'Hermoso departamento con vista al río, a pasos de la playa.';
        expect(stripRichDescriptionSyntax(plain)).toBe(plain);
    });

    it('neutralizes mixed rich content in a single description', () => {
        const rich = '**Bold**\n- item one\n- item two with a [link](https://example.com)';
        const stripped = stripRichDescriptionSyntax(rich);
        expect(stripped).not.toContain('**');
        expect(stripped).not.toContain('- item');
        expect(stripped).not.toContain('](');
        expect(stripped).toContain('Bold');
        expect(stripped).toContain('item one');
        expect(stripped).toContain('link');
    });
});

describe('containsVideoEmbed', () => {
    it('matches a YouTube URL', () => {
        expect(containsVideoEmbed('Watch at https://www.youtube.com/watch?v=abc123')).toBe(true);
    });

    it('matches a youtu.be short URL', () => {
        expect(containsVideoEmbed('https://youtu.be/abc123')).toBe(true);
    });

    it('matches a Vimeo URL', () => {
        expect(containsVideoEmbed('https://vimeo.com/123456')).toBe(true);
    });

    it('matches a Dailymotion URL', () => {
        expect(containsVideoEmbed('https://www.dailymotion.com/video/x7abc12')).toBe(true);
    });

    it('does not match a plain mention of "youtube" with no URL', () => {
        expect(containsVideoEmbed('Check out youtube for videos')).toBe(false);
    });
});

describe('stripVideoEmbeds', () => {
    it('removes a YouTube "watch" URL including its query string, keeping the surrounding text', () => {
        // Regression: VIDEO_EMBED_PATTERNS used to stop at the path segment
        // ([\w-]+), leaving the query string (e.g. "?v=abc123") behind as
        // visible junk. The pattern now also consumes a trailing query
        // string / fragment.
        expect(stripVideoEmbeds('Watch: https://www.youtube.com/watch?v=abc123')).toBe('Watch:');
    });

    it('removes a YouTube "watch" URL with extra query params (list, t)', () => {
        expect(
            stripVideoEmbeds('Watch: https://www.youtube.com/watch?v=abc123&list=xyz&t=42s')
        ).toBe('Watch:');
    });

    it('removes a youtu.be short URL, keeping the surrounding text', () => {
        expect(stripVideoEmbeds('Watch here: https://youtu.be/abc123 thanks')).toBe(
            'Watch here: thanks'
        );
    });

    it('removes a youtube.com/embed/<id> URL, keeping the surrounding text', () => {
        expect(stripVideoEmbeds('Embed: https://www.youtube.com/embed/abc123 here')).toBe(
            'Embed: here'
        );
    });

    it('removes a Vimeo URL, keeping the surrounding text', () => {
        expect(stripVideoEmbeds('Tour del depto: https://vimeo.com/123456 completo')).toBe(
            'Tour del depto: completo'
        );
    });

    it('leaves plain prose with no video URL untouched', () => {
        const plain = 'Hermoso departamento con vista al río.';
        expect(stripVideoEmbeds(plain)).toBe(plain);
    });

    it('removes all recognised video URLs when multiple are present', () => {
        const value =
            'https://www.youtube.com/watch?v=abc123 y también https://vimeo.com/123456 para ver';
        const stripped = stripVideoEmbeds(value);
        expect(stripped).not.toContain('youtube.com');
        expect(stripped).not.toContain('vimeo.com');
        expect(stripped).not.toContain('?v=');
        expect(stripped).toContain('para ver');
    });

    describe('HOS-216 regression: text pasted directly against the URL (no space)', () => {
        it('strips the query string but keeps a comma-joined word glued to it', () => {
            // Old `[^\s]*` tail ate ",altamente" too — it only stops at whitespace.
            expect(
                stripVideoEmbeds('Video: https://youtu.be/abc123?t=30s,altamente recomendado')
            ).toBe('Video: ,altamente recomendado');
        });

        it('strips the query string but keeps a ")."-joined word glued to it', () => {
            // Old tail ate ").Es" too — parens/periods aren't whitespace either.
            expect(
                stripVideoEmbeds('Video: https://www.youtube.com/watch?v=abc123).Es buenisimo')
            ).toBe('Video: ).Es buenisimo');
        });

        it('strips the query string but keeps a comma-joined word glued to it (no leading space)', () => {
            expect(stripVideoEmbeds('link:https://youtube.com/watch?v=X,recomendado')).toBe(
                'link:,recomendado'
            );
        });

        it('does not swallow the closing markdown paren when the URL is inside a markdown link', () => {
            expect(
                stripVideoEmbeds('Ver [el video](https://youtube.com/watch?v=abc123) para más')
            ).toBe('Ver [el video]() para más');
        });

        it('still strips a legitimate multi-param query string in full when followed by whitespace', () => {
            expect(
                stripVideoEmbeds(
                    'Watch: https://www.youtube.com/watch?v=abc123&list=xyz&t=42s here'
                )
            ).toBe('Watch: here');
        });

        it('still strips a legitimate query string in full at end of string', () => {
            expect(stripVideoEmbeds('https://youtu.be/abc123?t=30s')).toBe('');
        });
    });
});
