/**
 * @file pages/beta/search-index.json.ts
 * @description Build-time search index for the beta docs site.
 *
 * Emits `/beta/search-index.json` as a static asset. The `BetaSearch` island
 * fetches it lazily on first focus and feeds it to Fuse.js for fuzzy search.
 *
 * Strips markdown noise (frontmatter, code fences, link syntax, headings hashes)
 * from the body so Fuse scores against the prose, not the formatting.
 */

import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

export const prerender = true;

interface SearchEntry {
    readonly id: string;
    readonly title: string;
    readonly description: string;
    readonly role: string;
    readonly section: string;
    readonly url: string;
    readonly body: string;
    readonly audience?: ReadonlyArray<string>;
}

function stripMarkdown(input: string): string {
    return input
        .replace(/^---[\s\S]*?---/m, '') // frontmatter (already stripped by Astro, but defensive)
        .replace(/```[\s\S]*?```/g, ' ') // fenced code blocks
        .replace(/`[^`]*`/g, ' ') // inline code
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links → keep text
        .replace(/^#{1,6}\s+/gm, '') // heading hashes
        .replace(/[>*_~|]/g, ' ') // markdown punctuation
        .replace(/\s+/g, ' ') // collapse whitespace
        .trim();
}

export const GET: APIRoute = async () => {
    const docs = await getCollection('beta', (entry) => !entry.data.draft);

    const index: SearchEntry[] = docs.map((doc) => {
        const url = doc.id === 'index' ? '/beta/' : `/beta/${doc.id}/`;
        return {
            id: doc.id,
            title: doc.data.title,
            description: doc.data.description ?? '',
            role: doc.data.role,
            section: doc.data.section ?? '',
            url,
            body: stripMarkdown(doc.body ?? ''),
            audience: doc.data.audience
        };
    });

    return new Response(JSON.stringify(index), {
        headers: {
            'content-type': 'application/json',
            'cache-control': 'public, max-age=300'
        }
    });
};
