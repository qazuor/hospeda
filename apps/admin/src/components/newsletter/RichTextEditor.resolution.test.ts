import { Editor } from '@tiptap/react';
import { describe, expect, it } from 'vitest';
import { resolveCampaignContent } from '../../../../../packages/service-core/src/services/newsletter/dynamic/campaign-content';
import { renderCampaignContent } from '../../../../../packages/service-core/src/services/newsletter/dynamic/render-campaign-content';
import {
    dynamicConfig,
    dynamicPort
} from '../../../../../packages/service-core/test/services/newsletter/dynamic/content.fixtures';
import { NEWSLETTER_EDITOR_EXTENSIONS } from './RichTextEditor';

describe('newsletter editor to campaign resolver', () => {
    it('resolves and renders real editor JSON including nullable attributes and every editor mark', async () => {
        const editor = new Editor({
            extensions: NEWSLETTER_EDITOR_EXTENSIONS,
            content: {
                type: 'doc',
                content: [
                    { type: 'paragraph', content: [{ type: 'text', text: 'Plain introduction' }] },
                    {
                        type: 'dynamicBlock',
                        attrs: {
                            blockKey: dynamicConfig.blockKey,
                            config: JSON.stringify(dynamicConfig)
                        }
                    }
                ]
            }
        });
        try {
            const marks = Object.keys(editor.schema.marks);
            expect(marks.sort()).toEqual(['bold', 'code', 'italic', 'link', 'strike', 'underline']);
            const doc = editor.getJSON();
            expect(doc.content?.[0]?.attrs).toEqual({ textAlign: null });
            for (const mark of marks) {
                editor.commands.insertContentAt(1, {
                    type: 'text',
                    text: `${mark} text`,
                    marks: [
                        {
                            type: mark,
                            ...(mark === 'link' ? { attrs: { href: 'https://hospeda.test/' } } : {})
                        }
                    ]
                });
            }
            const bodyJson = editor.getJSON();
            const resolvedBodyJson = await resolveCampaignContent({
                doc: bodyJson,
                port: dynamicPort(),
                now: new Date()
            });
            expect(resolvedBodyJson?.doc).toEqual(bodyJson);
            const rendered = await renderCampaignContent({
                bodyJson,
                resolvedBodyJson,
                locale: 'es',
                renderTiptapEmailFn: () => 'unused',
                renderNewsletterEmailFn: async ({ doc: frozenDoc, resolvedBlocks }) => {
                    expect(frozenDoc).toEqual(bodyJson);
                    expect(resolvedBlocks?.[0]?.itemIds).toEqual(['item-b', 'item-a']);
                    return {
                        bodyHtml: '<p>Rendered</p>',
                        segments: ['<p>Rendered</p>'],
                        unresolvedBlockKeys: []
                    };
                }
            });
            expect(rendered).toEqual({
                bodyHtml: '<p>Rendered</p>',
                segments: ['<p>Rendered</p>']
            });
        } finally {
            editor.destroy();
        }
    });
});
