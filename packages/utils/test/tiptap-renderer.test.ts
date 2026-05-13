import { describe, expect, it } from 'vitest';
import { type TiptapDocument, renderTiptapContent } from '../src/tiptap-renderer';

describe('renderTiptapContent', () => {
    describe('empty / nullish input', () => {
        it('returns empty string for null', () => {
            expect(renderTiptapContent({ content: null })).toBe('');
        });

        it('returns empty string for undefined', () => {
            expect(renderTiptapContent({ content: undefined })).toBe('');
        });

        it('returns empty string for an empty doc', () => {
            const doc: TiptapDocument = { type: 'doc', content: [] };
            expect(renderTiptapContent({ content: doc })).toBe('');
        });
    });

    describe('block nodes', () => {
        it('renders a paragraph with text', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'hello' }]
                    }
                ]
            };
            expect(renderTiptapContent({ content: doc })).toBe('<p>hello</p>');
        });

        it('renders headings at the given level (clamped 1-6)', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'heading',
                        attrs: { level: 2 },
                        content: [{ type: 'text', text: 'Title' }]
                    }
                ]
            };
            expect(renderTiptapContent({ content: doc })).toBe('<h2>Title</h2>');
        });

        it('clamps heading levels above 6 to h6', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'heading',
                        attrs: { level: 99 },
                        content: [{ type: 'text', text: 'X' }]
                    }
                ]
            };
            expect(renderTiptapContent({ content: doc })).toBe('<h6>X</h6>');
        });

        it('renders blockquote, codeBlock, lists, and listItems', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'blockquote',
                        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'q' }] }]
                    },
                    {
                        type: 'codeBlock',
                        content: [{ type: 'text', text: 'code()' }]
                    },
                    {
                        type: 'bulletList',
                        content: [
                            {
                                type: 'listItem',
                                content: [
                                    { type: 'paragraph', content: [{ type: 'text', text: 'a' }] }
                                ]
                            }
                        ]
                    },
                    {
                        type: 'orderedList',
                        content: [
                            {
                                type: 'listItem',
                                content: [
                                    { type: 'paragraph', content: [{ type: 'text', text: 'b' }] }
                                ]
                            }
                        ]
                    }
                ]
            };

            const html = renderTiptapContent({ content: doc });

            expect(html).toContain('<blockquote><p>q</p></blockquote>');
            expect(html).toContain('<pre><code>code()</code></pre>');
            expect(html).toContain('<ul><li><p>a</p></li></ul>');
            expect(html).toContain('<ol><li><p>b</p></li></ol>');
        });

        it('renders hardBreak as <br />', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            { type: 'text', text: 'line1' },
                            { type: 'hardBreak' },
                            { type: 'text', text: 'line2' }
                        ]
                    }
                ]
            };
            expect(renderTiptapContent({ content: doc })).toBe('<p>line1<br />line2</p>');
        });

        it('renders horizontalRule as <hr />', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [{ type: 'horizontalRule' }]
            };
            expect(renderTiptapContent({ content: doc })).toBe('<hr />');
        });

        it('renders images with escaped src and alt', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'image',
                        attrs: {
                            src: 'https://cdn.example.com/img.png?a=1&b=2',
                            alt: 'My "image"'
                        }
                    }
                ]
            };
            const html = renderTiptapContent({ content: doc });
            expect(html).toContain('src="https://cdn.example.com/img.png?a=1&amp;b=2"');
            expect(html).toContain('alt="My &quot;image&quot;"');
        });

        it('renders unknown node types as their children only', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'someUnknownContainer',
                        content: [{ type: 'text', text: 'survives' }]
                    }
                ]
            };
            expect(renderTiptapContent({ content: doc })).toBe('survives');
        });
    });

    describe('inline marks', () => {
        const wrap = (text: string, marks: TiptapDocument['content'][number]['marks']) =>
            ({
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{ type: 'text', text, marks }]
                    }
                ]
            }) satisfies TiptapDocument;

        it('renders bold as <strong>', () => {
            expect(renderTiptapContent({ content: wrap('x', [{ type: 'bold' }]) })).toBe(
                '<p><strong>x</strong></p>'
            );
        });

        it('renders italic as <em>', () => {
            expect(renderTiptapContent({ content: wrap('x', [{ type: 'italic' }]) })).toBe(
                '<p><em>x</em></p>'
            );
        });

        it('renders underline as <u>', () => {
            expect(renderTiptapContent({ content: wrap('x', [{ type: 'underline' }]) })).toBe(
                '<p><u>x</u></p>'
            );
        });

        it('renders code as <code>', () => {
            expect(renderTiptapContent({ content: wrap('x', [{ type: 'code' }]) })).toBe(
                '<p><code>x</code></p>'
            );
        });

        it('renders link with safe attributes and escaped href', () => {
            const html = renderTiptapContent({
                content: wrap('click', [
                    { type: 'link', attrs: { href: 'https://example.com?a=1&b=2' } }
                ])
            });
            expect(html).toBe(
                '<p><a href="https://example.com?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">click</a></p>'
            );
        });

        it('applies multiple marks in nesting order (first mark = outermost)', () => {
            const html = renderTiptapContent({
                content: wrap('x', [{ type: 'bold' }, { type: 'italic' }])
            });
            expect(html).toBe('<p><strong><em>x</em></strong></p>');
        });
    });

    describe('XSS safety', () => {
        it('escapes HTML in text nodes', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{ type: 'text', text: '<script>alert("xss")</script>' }]
                    }
                ]
            };
            const html = renderTiptapContent({ content: doc });
            expect(html).not.toContain('<script>');
            expect(html).toContain('&lt;script&gt;');
            expect(html).toContain('&quot;xss&quot;');
        });

        it('escapes single quotes and ampersands', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{ type: 'text', text: "Tom & Jerry's" }]
                    }
                ]
            };
            expect(renderTiptapContent({ content: doc })).toBe('<p>Tom &amp; Jerry&#39;s</p>');
        });
    });
});
