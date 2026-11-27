import { render } from '@react-email/components';
import type { TiptapDocument, TiptapNode } from '@repo/utils';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import type { NewsletterResolvedBlock } from '../../src/templates/newsletter/dynamic-block-cards.js';
import { NewsletterCampaign } from '../../src/templates/newsletter/newsletter-campaign.js';
import { renderNewsletterEmail } from '../../src/utils/render-newsletter-email.js';
import { renderTiptapEmailContent } from '../../src/utils/tiptap-email-renderer.js';

const block: NewsletterResolvedBlock = {
    blockKey: 'block-one',
    hidden: false,
    itemIds: ['one'],
    cards: {
        one: {
            es: {
                name: 'Resolved house',
                summary: 'Quiet stay',
                imageUrl: null,
                url: 'https://example.com/house/'
            }
        }
    }
};
const dynamic: TiptapNode = { type: 'dynamicBlock', attrs: { blockKey: block.blockKey } };
const before: TiptapNode = { type: 'paragraph', content: [{ type: 'text', text: 'Before cards' }] };
const after: TiptapNode = { type: 'paragraph', content: [{ type: 'text', text: 'After cards' }] };

describe('renderNewsletterEmail', () => {
    it('reports unresolved blocks when no frozen content is supplied', async () => {
        const result = await renderNewsletterEmail({
            doc: { type: 'doc', content: [dynamic] },
            locale: 'es'
        });
        expect(result.bodyHtml).toBe('');
        expect(result.unresolvedBlockKeys).toEqual(['block-one']);
    });

    it('omits a resolved empty block without flagging it as unresolved', async () => {
        const result = await renderNewsletterEmail({
            doc: { type: 'doc', content: [dynamic] },
            resolvedBlocks: [{ ...block, itemIds: [] }],
            locale: 'es'
        });
        expect(result).toEqual({ bodyHtml: '', segments: [], unresolvedBlockKeys: [] });
    });

    it('interleaves sanitized text and JSON-roundtripped resolved cards', async () => {
        const resolvedBlocks: NewsletterResolvedBlock[] = JSON.parse(JSON.stringify([block]));
        const result = await renderNewsletterEmail({
            doc: { type: 'doc', content: [before, dynamic, after] },
            resolvedBlocks,
            locale: 'en'
        });
        expect(result.segments).toHaveLength(3);
        expect(result.bodyHtml.indexOf('Before cards')).toBeLessThan(
            result.bodyHtml.indexOf('Resolved house')
        );
        expect(result.bodyHtml.indexOf('Resolved house')).toBeLessThan(
            result.bodyHtml.indexOf('After cards')
        );
        expect(result.bodyHtml).toContain('View accommodation');
        expect(result.bodyHtml).not.toContain('<!DOCTYPE');
        expect(result.unresolvedBlockKeys).toEqual([]);
    });

    it('omits hidden blocks and reports missing entries once in document order', async () => {
        const missing: TiptapNode = { type: 'dynamicBlock', attrs: { blockKey: 'missing-block' } };
        const result = await renderNewsletterEmail({
            doc: { type: 'doc', content: [dynamic, missing, missing, after] },
            resolvedBlocks: [{ ...block, hidden: true }],
            locale: 'es'
        });
        expect(result.bodyHtml).toBe(
            renderTiptapEmailContent({ content: { type: 'doc', content: [after] } })
        );
        expect(result.unresolvedBlockKeys).toEqual(['missing-block']);
    });

    it('handles leading, adjacent and trailing dynamic blocks without empty text wrappers', async () => {
        const result = await renderNewsletterEmail({
            doc: { type: 'doc', content: [dynamic, dynamic] },
            resolvedBlocks: [block],
            locale: 'es'
        });
        expect(result.segments).toHaveLength(2);
        expect(result.bodyHtml.match(/data-newsletter-card=/g)).toHaveLength(2);
    });

    it('does not resolve nested dynamic nodes', async () => {
        const doc: TiptapDocument = {
            type: 'doc',
            content: [{ type: 'blockquote', content: [before, dynamic] }]
        };
        const result = await renderNewsletterEmail({ doc, locale: 'es' });
        expect(result.bodyHtml).toBe(renderTiptapEmailContent({ content: doc }));
        expect(result.unresolvedBlockKeys).toEqual([]);
    });

    it('keeps script markup inert and removes javascript links around blocks (AC-F1-15)', async () => {
        const unsafe: TiptapNode = {
            type: 'paragraph',
            content: [
                { type: 'text', text: '<script>alert(1)</script>' },
                {
                    type: 'text',
                    text: 'Unsafe link',
                    marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]
                },
                { type: 'script', text: 'alert(2)' }
            ]
        };
        const result = await renderNewsletterEmail({
            doc: { type: 'doc', content: [unsafe, dynamic, unsafe] },
            resolvedBlocks: [block],
            locale: 'es'
        });
        expect(result.bodyHtml).not.toMatch(/<\/?script\b/i);
        expect(result.bodyHtml).not.toContain('javascript:');
        expect(result.bodyHtml).toContain('&lt;script&gt;');
        expect(result.bodyHtml).toContain('Resolved house');
    });

    it.each([
        null,
        { type: 'doc', content: [] },
        { type: 'doc', content: [before, after] }
    ] satisfies (TiptapDocument | null)[])('preserves legacy body and full campaign bytes (AC-F1-16): %j', async (doc) => {
        const oldBody = renderTiptapEmailContent({ content: doc });
        const result = await renderNewsletterEmail({ doc, locale: 'es' });
        const props = {
            subject: 'Campaign',
            unsubscribeUrl: 'https://example.com/unsubscribe',
            bodyHtml: oldBody
        };
        const oldHtml = await render(createElement(NewsletterCampaign, props));
        expect(result.bodyHtml).toBe(oldBody);
        expect(
            await render(createElement(NewsletterCampaign, { ...props, bodyHtml: result.bodyHtml }))
        ).toBe(oldHtml);
        expect(
            await render(createElement(NewsletterCampaign, { ...props, segments: result.segments }))
        ).toBe(oldHtml);
    });
});
