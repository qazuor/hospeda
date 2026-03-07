import { renderTiptapContent } from '@/lib/tiptap-renderer';
import type { TiptapDocument } from '@/lib/tiptap-renderer';
/**
 * Tests for tiptap-renderer.ts - Tiptap JSON to HTML converter.
 */
import { describe, expect, it } from 'vitest';

// Helper to build a minimal TiptapDocument
function doc(...nodes: TiptapDocument['content']): TiptapDocument {
    return { type: 'doc', content: nodes };
}

describe('renderTiptapContent', () => {
    describe('empty / null input', () => {
        it('should return empty string for null', () => {
            expect(renderTiptapContent({ content: null })).toBe('');
        });

        it('should return empty string for undefined', () => {
            expect(renderTiptapContent({ content: undefined })).toBe('');
        });

        it('should return empty string for doc with no content', () => {
            expect(renderTiptapContent({ content: { type: 'doc', content: [] } })).toBe('');
        });
    });

    describe('paragraph', () => {
        it('should render a plain paragraph', () => {
            const result = renderTiptapContent({
                content: doc({
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Hello world' }]
                })
            });
            expect(result).toBe('<p>Hello world</p>');
        });

        it('should render an empty paragraph', () => {
            const result = renderTiptapContent({
                content: doc({ type: 'paragraph', content: [] })
            });
            expect(result).toBe('<p></p>');
        });
    });

    describe('headings', () => {
        it('should render h1 for level 1', () => {
            const result = renderTiptapContent({
                content: doc({
                    type: 'heading',
                    attrs: { level: 1 },
                    content: [{ type: 'text', text: 'Title' }]
                })
            });
            expect(result).toBe('<h1>Title</h1>');
        });

        it('should render h2 for level 2', () => {
            const result = renderTiptapContent({
                content: doc({
                    type: 'heading',
                    attrs: { level: 2 },
                    content: [{ type: 'text', text: 'Subtitle' }]
                })
            });
            expect(result).toBe('<h2>Subtitle</h2>');
        });

        it('should render h6 for level 6', () => {
            const result = renderTiptapContent({
                content: doc({
                    type: 'heading',
                    attrs: { level: 6 },
                    content: [{ type: 'text', text: 'Small' }]
                })
            });
            expect(result).toBe('<h6>Small</h6>');
        });

        it('should clamp heading level to h1 for level 0', () => {
            const result = renderTiptapContent({
                content: doc({
                    type: 'heading',
                    attrs: { level: 0 },
                    content: [{ type: 'text', text: 'Clamped' }]
                })
            });
            expect(result).toBe('<h1>Clamped</h1>');
        });
    });

    describe('inline marks', () => {
        it('should wrap bold text in <strong>', () => {
            const result = renderTiptapContent({
                content: doc({
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Bold', marks: [{ type: 'bold' }] }]
                })
            });
            expect(result).toBe('<p><strong>Bold</strong></p>');
        });

        it('should wrap italic text in <em>', () => {
            const result = renderTiptapContent({
                content: doc({
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Italic', marks: [{ type: 'italic' }] }]
                })
            });
            expect(result).toBe('<p><em>Italic</em></p>');
        });

        it('should wrap underline text in <u>', () => {
            const result = renderTiptapContent({
                content: doc({
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Under', marks: [{ type: 'underline' }] }]
                })
            });
            expect(result).toBe('<p><u>Under</u></p>');
        });

        it('should wrap inline code in <code>', () => {
            const result = renderTiptapContent({
                content: doc({
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'code()', marks: [{ type: 'code' }] }]
                })
            });
            expect(result).toBe('<p><code>code()</code></p>');
        });

        it('should render link with href, target, and rel', () => {
            const result = renderTiptapContent({
                content: doc({
                    type: 'paragraph',
                    content: [
                        {
                            type: 'text',
                            text: 'Click me',
                            marks: [{ type: 'link', attrs: { href: 'https://example.com' } }]
                        }
                    ]
                })
            });
            expect(result).toBe(
                '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">Click me</a></p>'
            );
        });

        it('should render combined bold + italic with correct nesting (outermost first)', () => {
            // marks = [bold, italic] => first mark in array = outermost
            // In applyMarks, marks are reversed so the first mark ends up as outermost:
            // reverse([bold, italic]) => [italic, bold]
            // reduce: italic wraps the text first, then bold wraps that
            // Result: <strong><em>text</em></strong>
            const result = renderTiptapContent({
                content: doc({
                    type: 'paragraph',
                    content: [
                        {
                            type: 'text',
                            text: 'Both',
                            marks: [{ type: 'bold' }, { type: 'italic' }]
                        }
                    ]
                })
            });
            expect(result).toBe('<p><strong><em>Both</em></strong></p>');
        });
    });

    describe('lists', () => {
        it('should render bullet list with <ul> and <li>', () => {
            const result = renderTiptapContent({
                content: doc({
                    type: 'bulletList',
                    content: [
                        {
                            type: 'listItem',
                            content: [
                                { type: 'paragraph', content: [{ type: 'text', text: 'Item 1' }] }
                            ]
                        },
                        {
                            type: 'listItem',
                            content: [
                                { type: 'paragraph', content: [{ type: 'text', text: 'Item 2' }] }
                            ]
                        }
                    ]
                })
            });
            expect(result).toBe('<ul><li><p>Item 1</p></li><li><p>Item 2</p></li></ul>');
        });

        it('should render ordered list with <ol> and <li>', () => {
            const result = renderTiptapContent({
                content: doc({
                    type: 'orderedList',
                    content: [
                        {
                            type: 'listItem',
                            content: [
                                { type: 'paragraph', content: [{ type: 'text', text: 'First' }] }
                            ]
                        }
                    ]
                })
            });
            expect(result).toBe('<ol><li><p>First</p></li></ol>');
        });
    });

    describe('blockquote and code block', () => {
        it('should render blockquote', () => {
            const result = renderTiptapContent({
                content: doc({
                    type: 'blockquote',
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Quote' }] }]
                })
            });
            expect(result).toBe('<blockquote><p>Quote</p></blockquote>');
        });

        it('should render codeBlock as <pre><code>', () => {
            const result = renderTiptapContent({
                content: doc({
                    type: 'codeBlock',
                    content: [{ type: 'text', text: 'const x = 1;' }]
                })
            });
            expect(result).toBe('<pre><code>const x = 1;</code></pre>');
        });
    });

    describe('hardBreak and image', () => {
        it('should render hardBreak as <br />', () => {
            const result = renderTiptapContent({
                content: doc({ type: 'hardBreak' })
            });
            expect(result).toBe('<br />');
        });

        it('should render image with src and alt', () => {
            const result = renderTiptapContent({
                content: doc({
                    type: 'image',
                    attrs: { src: 'https://example.com/photo.jpg', alt: 'A photo' }
                })
            });
            expect(result).toBe('<img src="https://example.com/photo.jpg" alt="A photo" />');
        });

        it('should render image with empty alt when not provided', () => {
            const result = renderTiptapContent({
                content: doc({
                    type: 'image',
                    attrs: { src: 'https://example.com/photo.jpg' }
                })
            });
            expect(result).toBe('<img src="https://example.com/photo.jpg" alt="" />');
        });
    });

    describe('XSS escaping', () => {
        it('should escape < and > in text nodes', () => {
            const result = renderTiptapContent({
                content: doc({
                    type: 'paragraph',
                    content: [{ type: 'text', text: '<script>alert("xss")</script>' }]
                })
            });
            expect(result).toContain('&lt;script&gt;');
            expect(result).not.toContain('<script>');
        });

        it('should escape & in text nodes', () => {
            const result = renderTiptapContent({
                content: doc({
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'A & B' }]
                })
            });
            expect(result).toContain('&amp;');
        });

        it('should escape " in link href', () => {
            const result = renderTiptapContent({
                content: doc({
                    type: 'paragraph',
                    content: [
                        {
                            type: 'text',
                            text: 'link',
                            marks: [
                                { type: 'link', attrs: { href: 'https://example.com?a="bad"' } }
                            ]
                        }
                    ]
                })
            });
            expect(result).toContain('&quot;');
        });
    });

    describe('unknown node types', () => {
        it('should render children of unknown nodes (passthrough)', () => {
            const result = renderTiptapContent({
                content: doc({
                    type: 'customNode' as string,
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Inside' }] }]
                })
            });
            expect(result).toBe('<p>Inside</p>');
        });
    });

    describe('multiple top-level nodes', () => {
        it('should concatenate multiple paragraphs', () => {
            const result = renderTiptapContent({
                content: doc(
                    { type: 'paragraph', content: [{ type: 'text', text: 'First' }] },
                    { type: 'paragraph', content: [{ type: 'text', text: 'Second' }] }
                )
            });
            expect(result).toBe('<p>First</p><p>Second</p>');
        });
    });
});
