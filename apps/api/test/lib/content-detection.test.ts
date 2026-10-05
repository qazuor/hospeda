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
