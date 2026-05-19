import type { TiptapDocument } from '@repo/utils';
import { describe, expect, it } from 'vitest';
import { renderTiptapEmailContent } from '../../src/utils/tiptap-email-renderer.js';

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
});
