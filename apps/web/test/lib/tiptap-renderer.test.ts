import { describe, expect, it } from 'vitest';
import {
    type TiptapDocument,
    type TiptapMark,
    type TiptapNode,
    renderTiptapContent
} from '../../src/lib/tiptap-renderer';

describe('renderTiptapContent', () => {
    describe('Null/Undefined Input', () => {
        it('should return empty string for null input', () => {
            const result = renderTiptapContent({ content: null });
            expect(result).toBe('');
        });

        it('should return empty string for undefined input', () => {
            const result = renderTiptapContent({ content: undefined });
            expect(result).toBe('');
        });

        it('should return empty string for document with no content', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: []
            };
            const result = renderTiptapContent({ content: doc });
            expect(result).toBe('');
        });
    });

    describe('Basic Node Types', () => {
        it('should render paragraph', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'Hello world' }]
                    }
                ]
            };
            const result = renderTiptapContent({ content: doc });
            expect(result).toBe('<p>Hello world</p>');
        });

        it('should render heading level 1', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'heading',
                        attrs: { level: 1 },
                        content: [{ type: 'text', text: 'Title' }]
                    }
                ]
            };
            const result = renderTiptapContent({ content: doc });
            expect(result).toBe('<h1>Title</h1>');
        });

        it('should render heading level 2', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'heading',
                        attrs: { level: 2 },
                        content: [{ type: 'text', text: 'Subtitle' }]
                    }
                ]
            };
            const result = renderTiptapContent({ content: doc });
            expect(result).toBe('<h2>Subtitle</h2>');
        });

        it('should render heading levels 3-6', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'heading',
                        attrs: { level: 3 },
                        content: [{ type: 'text', text: 'H3' }]
                    },
                    {
                        type: 'heading',
                        attrs: { level: 4 },
                        content: [{ type: 'text', text: 'H4' }]
                    },
                    {
                        type: 'heading',
                        attrs: { level: 5 },
                        content: [{ type: 'text', text: 'H5' }]
                    },
                    {
                        type: 'heading',
                        attrs: { level: 6 },
                        content: [{ type: 'text', text: 'H6' }]
                    }
                ]
            };
            const result = renderTiptapContent({ content: doc });
            expect(result).toBe('<h3>H3</h3><h4>H4</h4><h5>H5</h5><h6>H6</h6>');
        });

        it('should render blockquote', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'blockquote',
                        content: [
                            {
                                type: 'paragraph',
                                content: [{ type: 'text', text: 'Quote text' }]
                            }
                        ]
                    }
                ]
            };
            const result = renderTiptapContent({ content: doc });
            expect(result).toBe('<blockquote><p>Quote text</p></blockquote>');
        });

        it('should render code block', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'codeBlock',
                        content: [{ type: 'text', text: 'const x = 42;' }]
                    }
                ]
            };
            const result = renderTiptapContent({ content: doc });
            expect(result).toBe('<pre><code>const x = 42;</code></pre>');
        });

        it('should render hard break', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            { type: 'text', text: 'Line 1' },
                            { type: 'hardBreak' },
                            { type: 'text', text: 'Line 2' }
                        ]
                    }
                ]
            };
            const result = renderTiptapContent({ content: doc });
            expect(result).toBe('<p>Line 1<br />Line 2</p>');
        });

        it('should render image with alt text', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'image',
                        attrs: {
                            src: 'https://example.com/image.jpg',
                            alt: 'Example image'
                        }
                    }
                ]
            };
            const result = renderTiptapContent({ content: doc });
            expect(result).toBe('<img src="https://example.com/image.jpg" alt="Example image" />');
        });

        it('should render image without alt text', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'image',
                        attrs: {
                            src: 'https://example.com/image.jpg'
                        }
                    }
                ]
            };
            const result = renderTiptapContent({ content: doc });
            expect(result).toBe('<img src="https://example.com/image.jpg" alt="" />');
        });

        it('should render image without src attribute', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'image',
                        attrs: {}
                    }
                ]
            };
            const result = renderTiptapContent({ content: doc });
            expect(result).toBe('<img src="" alt="" />');
        });
    });

    describe('List Types', () => {
        it('should render bullet list', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'bulletList',
                        content: [
                            {
                                type: 'listItem',
                                content: [
                                    {
                                        type: 'paragraph',
                                        content: [{ type: 'text', text: 'Item 1' }]
                                    }
                                ]
                            },
                            {
                                type: 'listItem',
                                content: [
                                    {
                                        type: 'paragraph',
                                        content: [{ type: 'text', text: 'Item 2' }]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            };
            const result = renderTiptapContent({ content: doc });
            expect(result).toBe('<ul><li><p>Item 1</p></li><li><p>Item 2</p></li></ul>');
        });

        it('should render ordered list', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'orderedList',
                        content: [
                            {
                                type: 'listItem',
                                content: [
                                    {
                                        type: 'paragraph',
                                        content: [{ type: 'text', text: 'First' }]
                                    }
                                ]
                            },
                            {
                                type: 'listItem',
                                content: [
                                    {
                                        type: 'paragraph',
                                        content: [{ type: 'text', text: 'Second' }]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            };
            const result = renderTiptapContent({ content: doc });
            expect(result).toBe('<ol><li><p>First</p></li><li><p>Second</p></li></ol>');
        });
    });

    describe('Text Marks', () => {
        it('should render bold text', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'text',
                                text: 'Bold text',
                                marks: [{ type: 'bold' }]
                            }
                        ]
                    }
                ]
            };
            const result = renderTiptapContent({ content: doc });
            expect(result).toBe('<p><strong>Bold text</strong></p>');
        });

        it('should render italic text', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'text',
                                text: 'Italic text',
                                marks: [{ type: 'italic' }]
                            }
                        ]
                    }
                ]
            };
            const result = renderTiptapContent({ content: doc });
            expect(result).toBe('<p><em>Italic text</em></p>');
        });

        it('should render underline text', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'text',
                                text: 'Underlined text',
                                marks: [{ type: 'underline' }]
                            }
                        ]
                    }
                ]
            };
            const result = renderTiptapContent({ content: doc });
            expect(result).toBe('<p><u>Underlined text</u></p>');
        });

        it('should render inline code', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'text',
                                text: 'const x = 1;',
                                marks: [{ type: 'code' }]
                            }
                        ]
                    }
                ]
            };
            const result = renderTiptapContent({ content: doc });
            expect(result).toBe('<p><code>const x = 1;</code></p>');
        });

        it('should render link', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'text',
                                text: 'Click here',
                                marks: [
                                    {
                                        type: 'link',
                                        attrs: { href: 'https://example.com' }
                                    }
                                ]
                            }
                        ]
                    }
                ]
            };
            const result = renderTiptapContent({ content: doc });
            expect(result).toBe(
                '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">Click here</a></p>'
            );
        });

        it('should render multiple marks on same text', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'text',
                                text: 'Bold and italic',
                                marks: [{ type: 'bold' }, { type: 'italic' }]
                            }
                        ]
                    }
                ]
            };
            const result = renderTiptapContent({ content: doc });
            expect(result).toBe('<p><strong><em>Bold and italic</em></strong></p>');
        });

        it('should render link with bold', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'text',
                                text: 'Bold link',
                                marks: [
                                    { type: 'bold' },
                                    {
                                        type: 'link',
                                        attrs: { href: 'https://example.com' }
                                    }
                                ]
                            }
                        ]
                    }
                ]
            };
            const result = renderTiptapContent({ content: doc });
            expect(result).toBe(
                '<p><strong><a href="https://example.com" target="_blank" rel="noopener noreferrer">Bold link</a></strong></p>'
            );
        });
    });

    describe('HTML Escaping', () => {
        it('should escape HTML special characters in text', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'text',
                                text: '<script>alert("XSS")</script>'
                            }
                        ]
                    }
                ]
            };
            const result = renderTiptapContent({ content: doc });
            expect(result).toBe('<p>&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;</p>');
        });

        it('should escape ampersands', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'A & B' }]
                    }
                ]
            };
            const result = renderTiptapContent({ content: doc });
            expect(result).toBe('<p>A &amp; B</p>');
        });

        it('should escape quotes in link href', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'text',
                                text: 'Link',
                                marks: [
                                    {
                                        type: 'link',
                                        attrs: { href: 'https://example.com?foo="bar"' }
                                    }
                                ]
                            }
                        ]
                    }
                ]
            };
            const result = renderTiptapContent({ content: doc });
            expect(result).toContain('foo=&quot;bar&quot;');
        });
    });

    describe('Nested Structures', () => {
        it('should render nested lists', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'bulletList',
                        content: [
                            {
                                type: 'listItem',
                                content: [
                                    {
                                        type: 'paragraph',
                                        content: [{ type: 'text', text: 'Parent 1' }]
                                    },
                                    {
                                        type: 'bulletList',
                                        content: [
                                            {
                                                type: 'listItem',
                                                content: [
                                                    {
                                                        type: 'paragraph',
                                                        content: [{ type: 'text', text: 'Child 1' }]
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            };
            const result = renderTiptapContent({ content: doc });
            expect(result).toBe(
                '<ul><li><p>Parent 1</p><ul><li><p>Child 1</p></li></ul></li></ul>'
            );
        });

        it('should render list inside blockquote', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'blockquote',
                        content: [
                            {
                                type: 'paragraph',
                                content: [{ type: 'text', text: 'Quote:' }]
                            },
                            {
                                type: 'bulletList',
                                content: [
                                    {
                                        type: 'listItem',
                                        content: [
                                            {
                                                type: 'paragraph',
                                                content: [{ type: 'text', text: 'Point 1' }]
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            };
            const result = renderTiptapContent({ content: doc });
            expect(result).toBe(
                '<blockquote><p>Quote:</p><ul><li><p>Point 1</p></li></ul></blockquote>'
            );
        });
    });

    describe('Complex Document', () => {
        it('should render complex mixed content document', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'heading',
                        attrs: { level: 1 },
                        content: [{ type: 'text', text: 'Main Title' }]
                    },
                    {
                        type: 'paragraph',
                        content: [
                            { type: 'text', text: 'This is ' },
                            {
                                type: 'text',
                                text: 'bold',
                                marks: [{ type: 'bold' }]
                            },
                            { type: 'text', text: ' and this is ' },
                            {
                                type: 'text',
                                text: 'italic',
                                marks: [{ type: 'italic' }]
                            },
                            { type: 'text', text: '.' }
                        ]
                    },
                    {
                        type: 'heading',
                        attrs: { level: 2 },
                        content: [{ type: 'text', text: 'Features' }]
                    },
                    {
                        type: 'bulletList',
                        content: [
                            {
                                type: 'listItem',
                                content: [
                                    {
                                        type: 'paragraph',
                                        content: [{ type: 'text', text: 'Feature 1' }]
                                    }
                                ]
                            },
                            {
                                type: 'listItem',
                                content: [
                                    {
                                        type: 'paragraph',
                                        content: [{ type: 'text', text: 'Feature 2' }]
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
                                content: [
                                    { type: 'text', text: 'An important ' },
                                    {
                                        type: 'text',
                                        text: 'note',
                                        marks: [{ type: 'bold' }]
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        type: 'codeBlock',
                        content: [
                            {
                                type: 'text',
                                text: 'const example = "code";'
                            }
                        ]
                    }
                ]
            };
            const result = renderTiptapContent({ content: doc });
            expect(result).toBe(
                '<h1>Main Title</h1>' +
                    '<p>This is <strong>bold</strong> and this is <em>italic</em>.</p>' +
                    '<h2>Features</h2>' +
                    '<ul><li><p>Feature 1</p></li><li><p>Feature 2</p></li></ul>' +
                    '<blockquote><p>An important <strong>note</strong></p></blockquote>' +
                    '<pre><code>const example = &quot;code&quot;;</code></pre>'
            );
        });
    });

    describe('Edge Cases', () => {
        it('should handle heading without level attribute', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'heading',
                        content: [{ type: 'text', text: 'Default heading' }]
                    }
                ]
            };
            const result = renderTiptapContent({ content: doc });
            expect(result).toBe('<h1>Default heading</h1>');
        });

        it('should handle link without href attribute', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'text',
                                text: 'Empty link',
                                marks: [{ type: 'link' }]
                            }
                        ]
                    }
                ]
            };
            const result = renderTiptapContent({ content: doc });
            expect(result).toBe(
                '<p><a href="" target="_blank" rel="noopener noreferrer">Empty link</a></p>'
            );
        });

        it('should handle text node without text property', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{ type: 'text' } as TiptapNode]
                    }
                ]
            };
            const result = renderTiptapContent({ content: doc });
            expect(result).toBe('<p></p>');
        });

        it('should handle unknown node types gracefully', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'unknownNode',
                        content: [
                            {
                                type: 'paragraph',
                                content: [{ type: 'text', text: 'Inside unknown' }]
                            }
                        ]
                    }
                ]
            };
            const result = renderTiptapContent({ content: doc });
            expect(result).toBe('<p>Inside unknown</p>');
        });

        it('should handle unknown mark types gracefully', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'text',
                                text: 'Unknown mark',
                                marks: [{ type: 'unknownMark' } as unknown as TiptapMark]
                            }
                        ]
                    }
                ]
            };
            const result = renderTiptapContent({ content: doc });
            expect(result).toBe('<p>Unknown mark</p>');
        });

        it('should handle node without content property', () => {
            const doc: TiptapDocument = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph'
                    }
                ]
            };
            const result = renderTiptapContent({ content: doc });
            expect(result).toBe('<p></p>');
        });
    });
});
