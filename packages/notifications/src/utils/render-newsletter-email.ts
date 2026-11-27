import { render } from '@react-email/components';
import type { TiptapDocument, TiptapNode } from '@repo/utils';
import { createElement } from 'react';
import {
    DynamicBlockCards,
    type NewsletterCardLocale,
    type NewsletterResolvedBlock
} from '../templates/newsletter/dynamic-block-cards.js';
import { renderTiptapEmailContent } from './tiptap-email-renderer.js';

/** Document and JSON-safe frozen content; resolution belongs to the caller. */
export interface RenderNewsletterEmailInput {
    readonly doc: TiptapDocument | null | undefined;
    readonly resolvedBlocks?: readonly NewsletterResolvedBlock[];
    readonly locale: NewsletterCardLocale;
}

/** Trusted body fragments plus diagnostics the caller must check before sending. */
export interface RenderNewsletterEmailOutput {
    readonly bodyHtml: string;
    readonly segments: readonly string[];
    /** Missing resolutions; callers must fail with DYNAMIC_BLOCK_UNRESOLVED. */
    readonly unresolvedBlockKeys: readonly string[];
}

/**
 * Split only at root dynamic blocks, preserving the existing sanitizer for text.
 * Returns one body string for attribution and optional fragments for the template.
 * A document without dynamic blocks takes the original renderer path verbatim.
 */
export async function renderNewsletterEmail({
    doc,
    resolvedBlocks = [],
    locale
}: RenderNewsletterEmailInput): Promise<RenderNewsletterEmailOutput> {
    if (!doc?.content.some((node) => node.type === 'dynamicBlock')) {
        const bodyHtml = renderTiptapEmailContent({ content: doc });
        return { bodyHtml, segments: [bodyHtml], unresolvedBlockKeys: [] };
    }

    const blocks = new Map(resolvedBlocks.map((block) => [block.blockKey, block]));
    const segments: string[] = [];
    const unresolvedBlockKeys = new Set<string>();
    let textNodes: TiptapNode[] = [];
    const flushText = () => {
        if (textNodes.length === 0) return;
        segments.push(renderTiptapEmailContent({ content: { type: 'doc', content: textNodes } }));
        textNodes = [];
    };

    for (const node of doc.content) {
        if (node.type !== 'dynamicBlock') {
            textNodes.push(node);
            continue;
        }
        flushText();
        const blockKey = typeof node.attrs?.blockKey === 'string' ? node.attrs.blockKey : '';
        const block = blocks.get(blockKey);
        if (!block) {
            unresolvedBlockKeys.add(blockKey);
            continue;
        }
        if (block.hidden || block.itemIds.length === 0) continue;
        const html = await render(createElement(DynamicBlockCards, { block, locale }));
        // React Email adds a document doctype even when rendering a body fragment.
        segments.push(html.replace(/^<!DOCTYPE[^>]*>/i, ''));
    }
    flushText();
    return { bodyHtml: segments.join(''), segments, unresolvedBlockKeys: [...unresolvedBlockKeys] };
}
