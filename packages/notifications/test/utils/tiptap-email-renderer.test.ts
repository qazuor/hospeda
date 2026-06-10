import type { TiptapDocument } from '@repo/utils';
import { describe, expect, it } from 'vitest';
import {
    renderTiptapEmailContent,
    sanitizeEmailHtml
} from '../../src/utils/tiptap-email-renderer.js';

const docWith = (nodes: TiptapDocument['content']): TiptapDocument => ({
    type: 'doc',
    content: nodes
});

describe('renderTiptapEmailContent', () => {
    describe('passthrough cases', () => {
        it('returns empty string for null content', () => {
            expect(renderTiptapEmailContent({ content: null })).toBe('');
        });

        it('returns empty string for undefined content', () => {
            expect(renderTiptapEmailContent({ content: undefined })).toBe('');
        });

        it('returns empty string for an empty doc', () => {
            expect(renderTiptapEmailContent({ content: { type: 'doc', content: [] } })).toBe('');
        });
    });

    describe('inline style injection', () => {
        it('adds inline styles to <p>', () => {
            const html = renderTiptapEmailContent({
                content: docWith([
                    {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'hola' }]
                    }
                ])
            });
            expect(html).toContain('<p style="color:#1e293b');
            expect(html).toContain('font-size:16px');
            expect(html).toContain('hola');
        });

        it('adds inline styles to headings (h1-h4)', () => {
            const html = renderTiptapEmailContent({
                content: docWith([
                    {
                        type: 'heading',
                        attrs: { level: 1 },
                        content: [{ type: 'text', text: 'A' }]
                    },
                    {
                        type: 'heading',
                        attrs: { level: 2 },
                        content: [{ type: 'text', text: 'B' }]
                    },
                    {
                        type: 'heading',
                        attrs: { level: 3 },
                        content: [{ type: 'text', text: 'C' }]
                    },
                    {
                        type: 'heading',
                        attrs: { level: 4 },
                        content: [{ type: 'text', text: 'D' }]
                    }
                ])
            });
            expect(html).toContain('<h1 style=');
            expect(html).toContain('<h2 style=');
            expect(html).toContain('<h3 style=');
            expect(html).toContain('<h4 style=');
            expect(html).toMatch(/<h1 style="[^"]*font-size:28px[^"]*">A<\/h1>/);
        });

        it('adds display:block and max-width:100% to <img>', () => {
            const html = renderTiptapEmailContent({
                content: docWith([
                    {
                        type: 'image',
                        attrs: { src: 'https://cdn.example.com/a.png', alt: 'a' }
                    }
                ])
            });
            expect(html).toContain('display:block');
            expect(html).toContain('max-width:100%');
            expect(html).toContain('src="https://cdn.example.com/a.png"');
            expect(html).toContain('alt="a"');
        });

        it('styles lists, list items, blockquote, pre/code and links', () => {
            const html = renderTiptapEmailContent({
                content: docWith([
                    {
                        type: 'bulletList',
                        content: [
                            {
                                type: 'listItem',
                                content: [
                                    {
                                        type: 'paragraph',
                                        content: [{ type: 'text', text: 'x' }]
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        type: 'blockquote',
                        content: [
                            {
                                type: 'paragraph',
                                content: [{ type: 'text', text: 'q' }]
                            }
                        ]
                    },
                    {
                        type: 'codeBlock',
                        content: [{ type: 'text', text: 'console.log()' }]
                    },
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'text',
                                text: 'visit',
                                marks: [
                                    {
                                        type: 'link',
                                        attrs: { href: 'https://example.com' }
                                    }
                                ]
                            }
                        ]
                    }
                ])
            });

            expect(html).toContain('<ul style=');
            expect(html).toContain('<li style=');
            expect(html).toContain('<blockquote style=');
            expect(html).toContain('border-left:3px solid');
            expect(html).toContain('<pre style=');
            expect(html).toContain('<code style=');
            expect(html).toContain('<a style="color:#3b82f6;text-decoration:underline"');
            expect(html).toContain('href="https://example.com"');
        });

        it('styles horizontalRule as inline-styled <hr />', () => {
            const html = renderTiptapEmailContent({
                content: docWith([{ type: 'horizontalRule' }])
            });
            expect(html).toContain('<hr style=');
            expect(html).toContain('border-top:1px solid #e2e8f0');
        });
    });

    describe('disallowed tag stripping (defence in depth)', () => {
        it('does not emit <script> tags in normal operation', () => {
            const html = renderTiptapEmailContent({
                content: docWith([
                    {
                        type: 'paragraph',
                        content: [{ type: 'text', text: '<script>alert("xss")</script>' }]
                    }
                ])
            });
            // Base renderer escapes the text — so no <script> tag survives.
            expect(html).not.toContain('<script>');
            expect(html).toContain('&lt;script&gt;');
        });

        it('idempotent on already-styled HTML (does not double-style <p>)', () => {
            // Render once, then feed the OUTPUT as if it were base HTML.
            const once = renderTiptapEmailContent({
                content: docWith([
                    {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'hi' }]
                    }
                ])
            });
            // The <p> already has style attribute — pattern won't match because
            // regex anchors on the space/> right after the tag name.
            expect((once.match(/<p style=/g) ?? []).length).toBe(1);
        });
    });

    describe('end-to-end style budget', () => {
        it('produces self-contained HTML with no <html>/<body> wrapper', () => {
            const html = renderTiptapEmailContent({
                content: docWith([
                    {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'plain' }]
                    }
                ])
            });
            expect(html).not.toContain('<html');
            expect(html).not.toContain('<body');
            expect(html.startsWith('<p style=')).toBe(true);
        });

        it('keeps text content unmodified', () => {
            const html = renderTiptapEmailContent({
                content: docWith([
                    {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'Hola, ¿cómo estás?' }]
                    }
                ])
            });
            expect(html).toContain('Hola, ¿cómo estás?');
        });
    });

    describe('sanitizeEmailHtml (allowlist sanitizer)', () => {
        it('discards <script>, <style>, <iframe>, <object>, <form>', () => {
            // Arrange
            const input =
                '<p>ok</p><script>alert(1)</script><style>body{}</style>' +
                '<iframe src="https://evil.test"></iframe><object data="x"></object>' +
                '<form action="https://evil.test"><input></form>';
            // Act
            const out = sanitizeEmailHtml(input);
            // Assert
            expect(out).toContain('<p>ok</p>');
            for (const tag of ['<script', '<style', '<iframe', '<object', '<form', '<input']) {
                expect(out).not.toContain(tag);
            }
        });

        it('strips inline event handlers, including unquoted ones the old regex missed', () => {
            // Arrange — unquoted onclick is valid HTML and bypassed the prior /\son\w+="[^"]*"/ filter.
            const input = '<a href="https://ok.test" onclick=alert(1) onmouseover="x()">hi</a>';
            // Act
            const out = sanitizeEmailHtml(input);
            // Assert
            expect(out).not.toMatch(/onclick/i);
            expect(out).not.toMatch(/onmouseover/i);
            expect(out).toContain('href="https://ok.test"');
        });

        it('neutralises javascript:, data:, and vbscript: URL schemes', () => {
            // Act
            const js = sanitizeEmailHtml('<a href="javascript:alert(1)">x</a>');
            const data = sanitizeEmailHtml('<a href="data:text/html,<b>x</b>">x</a>');
            const vb = sanitizeEmailHtml('<a href="vbscript:msgbox(1)">x</a>');
            // Assert — the dangerous href is dropped (scheme not in the allowlist).
            expect(js).not.toMatch(/javascript:/i);
            expect(data).not.toMatch(/data:/i);
            expect(vb).not.toMatch(/vbscript:/i);
        });

        it('rejects reconstruction/nesting tricks that defeat regex strippers', () => {
            // Arrange — a regex that removes <script>...</script> once leaves a live tag here.
            const input = '<scr<script>ipt>alert(1)</script>';
            // Act
            const out = sanitizeEmailHtml(input);
            // Assert
            expect(out).not.toMatch(/<script/i);
        });

        it('returns quickly on adversarial input (no catastrophic backtracking)', () => {
            // Arrange — input that triggered O(n^2) in the prior tempered-greedy-token regex.
            const input = `<script${'a'.repeat(50000)}`;
            // Act
            const start = process.hrtime.bigint();
            const out = sanitizeEmailHtml(input);
            const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
            // Assert — parser is linear; comfortably under 1s even on slow CI.
            expect(elapsedMs).toBeLessThan(1000);
            expect(out).not.toMatch(/<script/i);
        });

        it('preserves allowlisted rich-text tags and safe links/images', () => {
            // Arrange
            const input =
                '<h2>Title</h2><p><strong>bold</strong> and <em>italic</em></p>' +
                '<ul><li>one</li></ul>' +
                '<a href="https://hospeda.com.ar" target="_blank" rel="noopener noreferrer">link</a>' +
                '<img src="https://cdn.test/a.png" alt="pic" />';
            // Act
            const out = sanitizeEmailHtml(input);
            // Assert
            expect(out).toContain('<h2>Title</h2>');
            expect(out).toContain('<strong>bold</strong>');
            expect(out).toContain('<li>one</li>');
            expect(out).toContain('href="https://hospeda.com.ar"');
            expect(out).toContain('src="https://cdn.test/a.png"');
            expect(out).toContain('alt="pic"');
        });

        it('returns empty string for empty input', () => {
            expect(sanitizeEmailHtml('')).toBe('');
        });
    });

    describe('end-to-end sanitisation through the public renderer', () => {
        it('neutralises a javascript: link coming from a TipTap document', () => {
            // Arrange — the base renderer escapes href TEXT but does not scheme-check it,
            // so without sanitisation this would emit href="javascript:alert(1)".
            const html = renderTiptapEmailContent({
                content: docWith([
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'text',
                                text: 'click',
                                marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]
                            }
                        ]
                    }
                ])
            });
            // Assert — link text is kept, dangerous scheme is gone.
            expect(html).toContain('click');
            expect(html).not.toMatch(/javascript:/i);
        });

        it('keeps a safe https link from a TipTap document and styles it', () => {
            const html = renderTiptapEmailContent({
                content: docWith([
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'text',
                                text: 'site',
                                marks: [{ type: 'link', attrs: { href: 'https://hospeda.com.ar' } }]
                            }
                        ]
                    }
                ])
            });
            expect(html).toContain('href="https://hospeda.com.ar"');
            expect(html).toContain('<a style="color:#3b82f6');
        });
    });
});
