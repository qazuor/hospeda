/**
 * Unit tests for the meta / OpenGraph extractor (SPEC-222 T-010)
 *
 * Verifies that:
 * - og:title / og:description / og:image / og:url are extracted with
 *   `source: 'opengraph'`.
 * - <meta name="description"> is extracted with `source: 'meta'`.
 * - geo.position / ICBM meta tags are parsed into lat/long string pairs.
 * - Property and content attributes may appear in either order.
 * - stripHtmlToText removes scripts/styles/tags, collapses whitespace, and
 *   respects the maxChars limit.
 * - Missing tags produce absent fields without throwing.
 */

import { describe, expect, it } from 'vitest';

import {
    extractOpenGraph,
    stripHtmlToText
} from '../../../../src/services/accommodation-import/extractors/meta.js';

// ---------------------------------------------------------------------------
// extractOpenGraph
// ---------------------------------------------------------------------------

describe('extractOpenGraph', () => {
    describe('given a page with og:title / og:description / og:image / og:url', () => {
        const HTML = `
            <html>
            <head>
                <meta property="og:title" content="Hotel Sol del Sur" />
                <meta property="og:description" content="El mejor hotel de la costa." />
                <meta property="og:image" content="https://example.com/hero.jpg" />
                <meta property="og:url" content="https://hotelsolsur.com" />
                <meta name="description" content="Descripción estándar de la página." />
            </head>
            <body></body>
            </html>
        `;

        it('should extract og:title with source opengraph', () => {
            // Arrange + Act
            const result = extractOpenGraph({ html: HTML });

            // Assert
            expect(result.title).toBeDefined();
            expect(result.title?.value).toBe('Hotel Sol del Sur');
            expect(result.title?.source).toBe('opengraph');
        });

        it('should extract og:description with source opengraph', () => {
            const result = extractOpenGraph({ html: HTML });
            expect(result.ogDescription?.value).toBe('El mejor hotel de la costa.');
            expect(result.ogDescription?.source).toBe('opengraph');
        });

        it('should extract og:image with source opengraph', () => {
            const result = extractOpenGraph({ html: HTML });
            expect(result.image?.value).toBe('https://example.com/hero.jpg');
            expect(result.image?.source).toBe('opengraph');
        });

        it('should extract og:url with source opengraph', () => {
            const result = extractOpenGraph({ html: HTML });
            expect(result.ogUrl?.value).toBe('https://hotelsolsur.com');
            expect(result.ogUrl?.source).toBe('opengraph');
        });

        it('should extract meta name=description with source meta', () => {
            const result = extractOpenGraph({ html: HTML });
            expect(result.metaDescription?.value).toBe('Descripción estándar de la página.');
            expect(result.metaDescription?.source).toBe('meta');
        });
    });

    describe('attribute order tolerance — content before property', () => {
        it('should extract og:title when content precedes property', () => {
            // Arrange — reversed attribute order
            const html = `<meta content="Título Invertido" property="og:title" />`;

            // Act
            const result = extractOpenGraph({ html });

            // Assert
            expect(result.title?.value).toBe('Título Invertido');
            expect(result.title?.source).toBe('opengraph');
        });

        it('should extract og:image when content precedes property', () => {
            const html = `<meta content="https://example.com/img.jpg" property="og:image">`;
            const result = extractOpenGraph({ html });
            expect(result.image?.value).toBe('https://example.com/img.jpg');
        });
    });

    describe('attribute order tolerance — single-quoted attribute values', () => {
        it('should extract og:title from single-quoted attributes', () => {
            const html = `<meta property='og:title' content='Título con comillas simples' />`;
            const result = extractOpenGraph({ html });
            expect(result.title?.value).toBe('Título con comillas simples');
        });
    });

    describe('geo.position extraction', () => {
        it('should parse geo.position with semicolon separator', () => {
            const html = `<meta name="geo.position" content="-32.484;-58.232" />`;
            const result = extractOpenGraph({ html });

            expect(result.geoPosition).toBeDefined();
            expect(result.geoPosition?.lat).toBe('-32.484');
            expect(result.geoPosition?.long).toBe('-58.232');
            expect(result.geoPosition?.source).toBe('meta');
        });

        it('should parse ICBM with semicolon separator', () => {
            const html = `<meta name="ICBM" content="-32.484;-58.232" />`;
            const result = extractOpenGraph({ html });

            expect(result.geoPosition?.lat).toBe('-32.484');
            expect(result.geoPosition?.long).toBe('-58.232');
            expect(result.geoPosition?.source).toBe('meta');
        });

        it('should parse geo.position with comma separator', () => {
            const html = `<meta name="geo.position" content="-32.484,-58.232" />`;
            const result = extractOpenGraph({ html });

            expect(result.geoPosition?.lat).toBe('-32.484');
            expect(result.geoPosition?.long).toBe('-58.232');
        });

        it('should return no geoPosition when coordinates are non-numeric', () => {
            const html = `<meta name="geo.position" content="not;a;number" />`;
            const result = extractOpenGraph({ html });
            expect(result.geoPosition).toBeUndefined();
        });

        it('should return no geoPosition when content is missing', () => {
            const html = `<meta name="geo.position" />`;
            const result = extractOpenGraph({ html });
            expect(result.geoPosition).toBeUndefined();
        });
    });

    describe('given a page with no meta tags', () => {
        it('should return an empty result without throwing', () => {
            const html = '<html><head><title>Sin meta</title></head><body></body></html>';
            const result = extractOpenGraph({ html });

            expect(result.title).toBeUndefined();
            expect(result.ogDescription).toBeUndefined();
            expect(result.image).toBeUndefined();
            expect(result.ogUrl).toBeUndefined();
            expect(result.metaDescription).toBeUndefined();
            expect(result.geoPosition).toBeUndefined();
        });
    });

    describe('given a page with only irrelevant meta tags', () => {
        it('should return an empty result', () => {
            const html = `
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="robots" content="index,follow" />
                <meta property="fb:app_id" content="12345" />
            `;
            const result = extractOpenGraph({ html });
            expect(result.title).toBeUndefined();
            expect(result.image).toBeUndefined();
        });
    });

    describe('duplicate tags — first occurrence wins', () => {
        it('should use the first og:title when multiple are present', () => {
            const html = `
                <meta property="og:title" content="Primero" />
                <meta property="og:title" content="Segundo" />
            `;
            const result = extractOpenGraph({ html });
            expect(result.title?.value).toBe('Primero');
        });
    });

    describe('empty content attribute', () => {
        it('should not populate title when content is empty', () => {
            const html = `<meta property="og:title" content="" />`;
            const result = extractOpenGraph({ html });
            expect(result.title).toBeUndefined();
        });
    });
});

// ---------------------------------------------------------------------------
// stripHtmlToText
// ---------------------------------------------------------------------------

describe('stripHtmlToText', () => {
    describe('basic stripping', () => {
        it('should remove HTML tags', () => {
            // Arrange
            const html = '<p>Hola <strong>mundo</strong></p>';

            // Act
            const result = stripHtmlToText({ html, maxChars: 1000 });

            // Assert
            expect(result).toBe('Hola mundo');
        });

        it('should remove <script> blocks including their content', () => {
            const html = '<p>Visible</p><script>var x = "invisible";</script><p>Después</p>';
            const result = stripHtmlToText({ html, maxChars: 1000 });
            expect(result).not.toContain('invisible');
            expect(result).toContain('Visible');
            expect(result).toContain('Después');
        });

        it('should remove <style> blocks including their content', () => {
            const html = '<p>Visible</p><style>.hidden { display: none; }</style><p>Fin</p>';
            const result = stripHtmlToText({ html, maxChars: 1000 });
            expect(result).not.toContain('.hidden');
            expect(result).toContain('Visible');
        });

        it('should collapse multiple whitespace characters into a single space', () => {
            const html = '<p>Mucho    espacio\n\n\naquí\t\ttabulaciones</p>';
            const result = stripHtmlToText({ html, maxChars: 1000 });
            expect(result).toBe('Mucho espacio aquí tabulaciones');
        });

        it('should trim leading and trailing whitespace', () => {
            const html = '   <p>Texto</p>   ';
            const result = stripHtmlToText({ html, maxChars: 1000 });
            expect(result).toBe('Texto');
        });
    });

    describe('maxChars truncation', () => {
        it('should truncate output to maxChars characters', () => {
            const html = '<p>ABCDEFGHIJ</p>';
            const result = stripHtmlToText({ html, maxChars: 5 });
            expect(result).toBe('ABCDE');
            expect(result.length).toBe(5);
        });

        it('should not truncate when text is shorter than maxChars', () => {
            const html = '<p>Corto</p>';
            const result = stripHtmlToText({ html, maxChars: 1000 });
            expect(result).toBe('Corto');
        });

        it('should return an empty string for an empty input', () => {
            const result = stripHtmlToText({ html: '', maxChars: 1000 });
            expect(result).toBe('');
        });
    });

    describe('HTML entity decoding', () => {
        it('should decode &amp; to &', () => {
            const html = '<p>Tango &amp; Milonga</p>';
            const result = stripHtmlToText({ html, maxChars: 1000 });
            expect(result).toBe('Tango & Milonga');
        });

        it('should decode &lt; and &gt;', () => {
            const html = '<p>5 &lt; 10 &gt; 3</p>';
            const result = stripHtmlToText({ html, maxChars: 1000 });
            expect(result).toBe('5 < 10 > 3');
        });

        it('should decode &quot; and &#39;', () => {
            const html = '<p>&quot;Hola&quot; &#39;mundo&#39;</p>';
            const result = stripHtmlToText({ html, maxChars: 1000 });
            expect(result).toBe('"Hola" \'mundo\'');
        });

        it('should decode &nbsp; to a space', () => {
            const html = '<p>Palabra&nbsp;separada</p>';
            const result = stripHtmlToText({ html, maxChars: 1000 });
            // After collapse, multiple spaces become one
            expect(result).toBe('Palabra separada');
        });
    });

    describe('complex real-world page content', () => {
        it('should extract readable text from a realistic page snippet', () => {
            const html = `
                <!DOCTYPE html>
                <html lang="es">
                <head>
                    <meta charset="UTF-8" />
                    <title>Cabaña del Río</title>
                    <style>
                        body { font-family: sans-serif; }
                        .hidden { display: none; }
                    </style>
                </head>
                <body>
                    <h1>Cabaña del Río</h1>
                    <p>Hermosa cabaña junto al río.</p>
                    <script>
                        const data = { price: 5000, currency: "ARS" };
                        console.log("Datos internos");
                    </script>
                    <ul>
                        <li>WiFi</li>
                        <li>Piscina</li>
                    </ul>
                </body>
                </html>
            `;

            const result = stripHtmlToText({ html, maxChars: 10000 });

            // Script and style content must be absent
            expect(result).not.toContain('font-family');
            expect(result).not.toContain('console.log');
            expect(result).not.toContain('Datos internos');

            // Real content must be present
            expect(result).toContain('Cabaña del Río');
            expect(result).toContain('Hermosa cabaña junto al río');
            expect(result).toContain('WiFi');
            expect(result).toContain('Piscina');
        });
    });
});
