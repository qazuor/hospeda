/**
 * @file RichTextEditor.v3-roundtrip.test.ts
 *
 * Tiptap v3 extension-compatibility + value round-trip test for the newsletter
 * editor.
 *
 * This is the exact coverage gap that let Dependabot PR #1890 look green: no
 * test ever mounted the editor with the full extension set (StarterKit + the
 * bundled Link/Underline + Image + TextAlign), so a cross-major mismatch —
 * a v3 extension on a v2 core — produced no failure. A real, headless
 * `Editor` instance constructed with the same extensions the component uses
 * (mirrors `RichTextEditor.tsx`) both:
 *   1. fails at construction time if any extension major diverges from core, and
 *   2. lets us assert the JSON/HTML round-trip is preserved under v3.
 *
 * Kept headless (`new Editor` with no `element`) — deterministic in jsdom,
 * unlike the async ProseMirror view mount.
 */

import {
    DynamicBlockConfigSchema,
    NewsletterDynamicEntityTypeEnum,
    NewsletterDynamicSourceEnum,
    NewsletterIfBelowMinEnum
} from '@repo/schemas';
import type { JSONContent } from '@tiptap/react';
import { Editor } from '@tiptap/react';
import { afterEach, describe, expect, it } from 'vitest';
import { NEWSLETTER_EDITOR_EXTENSIONS } from './RichTextEditor';

const dynamicConfig = {
    entityType: NewsletterDynamicEntityTypeEnum.ACCOMMODATION,
    source: NewsletterDynamicSourceEnum.NEWEST,
    count: 4
};

/**
 * Constructs a headless editor with the component's real, exported extension
 * set — not a copy — so this test can never drift from what ships.
 */
function createNewsletterEditor(content: JSONContent | null): Editor {
    return new Editor({
        extensions: NEWSLETTER_EDITOR_EXTENSIONS,
        content: content ?? undefined
    });
}

let editor: Editor | null = null;

afterEach(() => {
    editor?.destroy();
    editor = null;
});

describe('newsletter RichTextEditor — Tiptap v3 extension compatibility', () => {
    it('inserts an atomic root block with a valid generated key and shared defaults', () => {
        editor = createNewsletterEditor(null);
        expect(editor.commands.insertDynamicBlock({ config: dynamicConfig })).toBe(true);
        const block = editor.getJSON().content?.find((node) => node.type === 'dynamicBlock');
        expect(block?.attrs?.blockKey).toMatch(/^[a-z0-9-]{8,64}$/);
        expect(block?.attrs?.ifBelowMinManual).toBe(false);
        expect(block?.content).toBeUndefined();
        const config = DynamicBlockConfigSchema.parse(JSON.parse(block?.attrs?.config));
        expect(config).toMatchObject({
            ...dynamicConfig,
            blockKey: block?.attrs?.blockKey,
            minItems: 1,
            ifBelowMin: NewsletterIfBelowMinEnum.SKIP_RUN
        });
        expect(editor.schema.nodes.dynamicBlock.spec.atom).toBe(true);
        expect(editor.commands.insertDynamicBlock({ config: dynamicConfig })).toBe(true);
        const blocks = editor.getJSON().content?.filter((node) => node.type === 'dynamicBlock');
        expect(new Set(blocks?.map((node) => node.attrs?.blockKey)).size).toBe(2);
    });

    it.each([
        false,
        true
    ])('preserves all dynamic attrs through setContent (manual=%s)', (manual) => {
        editor = createNewsletterEditor(null);
        editor.commands.insertDynamicBlock({ config: dynamicConfig });
        const json = editor.getJSON();
        const block = json.content?.find((node) => node.type === 'dynamicBlock');
        if (!block?.attrs) throw new Error('Expected inserted dynamic block');
        block.attrs.ifBelowMinManual = manual;
        // Preserve the exact serialized config, including whitespace and manual policy.
        block.attrs.config = JSON.stringify(
            {
                ...JSON.parse(block.attrs.config),
                ifBelowMin: NewsletterIfBelowMinEnum.SEND_ANYWAY
            },
            null,
            2
        );
        editor.commands.setContent(json);
        expect(editor.getJSON().content?.find((node) => node.type === 'dynamicBlock')).toEqual(
            block
        );
        const saved = editor.getJSON();
        editor.commands.setContent(saved);
        expect(editor.getJSON()).toEqual(saved);
    });

    it('preserves config and boolean attrs through HTML serialization', () => {
        editor = createNewsletterEditor(null);
        editor.commands.insertDynamicBlock({ config: dynamicConfig });
        editor.commands.updateAttributes('dynamicBlock', { ifBelowMinManual: true });
        const before = editor.getJSON().content?.find((node) => node.type === 'dynamicBlock');
        editor.commands.setContent(editor.getHTML());
        expect(editor.getJSON().content?.find((node) => node.type === 'dynamicBlock')).toEqual(
            before
        );
    });

    it.each([
        'blockquote',
        'bulletList',
        'orderedList'
    ])('inserts outside %s and forbids nesting', (type) => {
        const paragraph = { type: 'paragraph', content: [{ type: 'text', text: 'Keep me' }] };
        const container = {
            type,
            content:
                type === 'blockquote' ? [paragraph] : [{ type: 'listItem', content: [paragraph] }]
        };
        editor = createNewsletterEditor({ type: 'doc', content: [container] });
        editor.commands.setTextSelection(type === 'blockquote' ? 2 : 3);
        expect(editor.commands.insertDynamicBlock({ config: dynamicConfig })).toBe(true);
        const json = editor.getJSON();
        expect(json.content?.[0].type).toBe(type);
        expect(json.content?.[1].type).toBe('dynamicBlock');
        expect(editor.getText()).toContain('Keep me');
        expect(() =>
            editor?.schema
                .nodeFromJSON({
                    type: 'doc',
                    content: [
                        {
                            type: 'blockquote',
                            content: [json.content?.[1]]
                        }
                    ]
                })
                .check()
        ).toThrow();
        expect(() =>
            editor?.schema
                .nodeFromJSON({
                    type: 'doc',
                    content: [
                        {
                            type: 'bulletList',
                            content: [
                                {
                                    type: 'listItem',
                                    content: [paragraph, json.content?.[1]]
                                }
                            ]
                        }
                    ]
                })
                .check()
        ).toThrow();
    });

    it.each([
        { ...dynamicConfig, count: 0 },
        { ...dynamicConfig, source: NewsletterDynamicSourceEnum.FEATURED },
        { ...dynamicConfig, entityType: NewsletterDynamicEntityTypeEnum.VENUE }
    ])('rejects invalid configuration without changing the document: %j', (config) => {
        editor = createNewsletterEditor(null);
        const before = editor.getJSON();
        expect(editor.commands.insertDynamicBlock({ config })).toBe(false);
        expect(editor.getJSON()).toEqual(before);
    });

    it('constructs with the full extension set without throwing (the #1890 canary)', () => {
        expect(() => {
            editor = createNewsletterEditor(null);
        }).not.toThrow();
        expect(editor).not.toBeNull();
    });

    it('exposes the bundled Link and Underline marks provided by StarterKit v3', () => {
        editor = createNewsletterEditor(null);
        const marks = editor.schema.marks;
        expect(marks.link).toBeDefined();
        expect(marks.underline).toBeDefined();
    });

    it('registers the TextAlign extension (the #1890 extension) and Image node', () => {
        editor = createNewsletterEditor(null);
        expect(editor.extensionManager.extensions.some((e) => e.name === 'textAlign')).toBe(true);
        expect(editor.schema.nodes.image).toBeDefined();
    });

    it('round-trips a document exercising heading, textAlign, underline, link and image', () => {
        const doc: JSONContent = {
            type: 'doc',
            content: [
                {
                    type: 'heading',
                    attrs: { level: 2, textAlign: 'center' },
                    content: [{ type: 'text', text: 'Título' }]
                },
                {
                    type: 'paragraph',
                    content: [
                        {
                            type: 'text',
                            marks: [{ type: 'underline' }],
                            text: 'subrayado'
                        },
                        { type: 'text', text: ' y ' },
                        {
                            type: 'text',
                            marks: [{ type: 'link', attrs: { href: 'https://hospeda.com.ar' } }],
                            text: 'enlace'
                        }
                    ]
                },
                {
                    type: 'image',
                    attrs: { src: 'https://hospeda.com.ar/logo.png' }
                }
            ]
        };

        editor = createNewsletterEditor(doc);
        const html = editor.getHTML();

        expect(html).toContain('text-align: center');
        expect(html).toContain('<u>subrayado</u>');
        expect(html).toContain('href="https://hospeda.com.ar"');
        expect(html).toContain('<img');
        expect(html).toContain('src="https://hospeda.com.ar/logo.png"');

        // JSON round-trip: the heading's textAlign attr survives serialization.
        const json = editor.getJSON();
        const heading = json.content?.find((n) => n.type === 'heading');
        expect(heading?.attrs?.textAlign).toBe('center');
    });

    it('preserves the bundled Link `openOnClick: false` configuration', () => {
        editor = createNewsletterEditor(null);
        const link = editor.extensionManager.extensions.find((e) => e.name === 'link');
        expect(link?.options.openOnClick).toBe(false);
    });
});
