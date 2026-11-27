import { describe, expect, it } from 'vitest';
import { renderTiptapContent, type TiptapDocument } from '../src/tiptap-renderer.js';

describe('TipTap boolean attributes', () => {
    it('accepts nullable editor attributes and preserves the existing unknown-mark fallback', () => {
        const doc: TiptapDocument = {
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    attrs: { textAlign: null },
                    content: [
                        {
                            type: 'text',
                            text: 'Unchanged',
                            marks: [{ type: 'strike' }, { type: 'link', attrs: { href: null } }]
                        }
                    ]
                }
            ]
        };
        expect(renderTiptapContent({ content: doc })).toBe(
            '<p><a href="" target="_blank" rel="noopener noreferrer">Unchanged</a></p>'
        );
    });
    it('accepts boolean attributes without changing rendered content', () => {
        const doc: TiptapDocument = {
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    attrs: { enabled: true },
                    content: [{ type: 'text', text: 'Unchanged' }]
                },
                { type: 'dynamicBlock', attrs: { blockKey: 'block-one', manuallyEdited: false } }
            ]
        };
        expect(renderTiptapContent({ content: doc })).toBe('<p>Unchanged</p>');
    });
});
