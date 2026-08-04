/**
 * @file listing-filter-gate.guard.test.ts
 * @description HOS-369 — a page that reads a filter param may not claim to be
 * unconditionally cacheable.
 *
 * This exists because the mistake it catches was made twice, by hand, in two
 * separate waves:
 *
 *   - `destinos/index.astro` (W2-3) was gated `cacheable: true` on the belief
 *     that its `?attractions=` filter was purely client-side. The toggle is —
 *     the frontmatter still reads the param to seed the badge state.
 *   - `gastronomia/index.astro` and `experiencias/index.astro` (W2-4) were
 *     gated `cacheable: true` while reading seven and eight filter params.
 *
 * Neither served wrong content, because the Cloudflare rule requires an empty
 * query string. But the origin was marking a filtered render shareable, and
 * `infra/cloudflare/rules/cache-rules.md` is explicit that the rule is not the
 * only thing that may ever cache these responses. Two humans reading the same
 * page comment agreed with it; only reading the whole frontmatter caught it.
 *
 * The check is DERIVED from the source, not from a list maintained here. A
 * hand-kept list of "pages that take filters" would have the same failure mode
 * as the comments it replaces: it is only right until somebody adds a param.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGES_ROOT = resolve(__dirname, '../../src/pages/[lang]');

/**
 * The frontmatter — everything between the opening `---` line and the closing
 * one, both alone on their line.
 *
 * Deliberately NOT `source.split('---')[1]`: comment banners like
 * `// --- Edge cacheability ---` contain the fence, so the naive split
 * truncates the frontmatter at the first one and silently hides everything
 * after it. That bug is how the two miscategorised pages above were cleared as
 * "reads no params" during review.
 */
function frontmatter(source: string): string {
    const lines = source.split('\n');
    if (lines[0]?.trim() !== '---') return source;
    for (let i = 1; i < lines.length; i++) {
        if (lines[i]?.trimEnd() === '---') return lines.slice(1, i).join('\n');
    }
    return source;
}

/** Argument text of a call, anchored on the call so it cannot match an import. */
function callArgsOf(source: string, call: string): string | null {
    const start = source.indexOf(`${call}(`);
    if (start === -1) return null;

    let depth = 0;
    for (let i = start + call.length; i < source.length; i++) {
        const char = source[i];
        if (char === '(') depth++;
        if (char === ')') {
            depth--;
            if (depth === 0) return source.slice(start, i + 1);
        }
    }
    return null;
}

/** Every `.astro` page under `src/pages/[lang]`. */
function allPages(dir: string = PAGES_ROOT): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) found.push(...allPages(full));
        else if (entry.endsWith('.astro')) found.push(full);
    }
    return found;
}

/** Params that do not narrow the result set, so their presence is not a filter. */
const NON_FILTERING = new Set(['page']);

describe('cacheable pages that read filter params (HOS-369)', () => {
    const offenders = allPages()
        .map((file) => {
            const source = readFileSync(file, 'utf8');
            const args = callArgsOf(source, 'applyCacheHeaders');
            if (!args) return null;

            // Only `cacheable: true` is a problem. A real predicate is the fix.
            if (!/cacheable:\s*true\b/.test(args)) return null;

            const params = [...frontmatter(source).matchAll(/searchParams\.get\('([^']+)'\)/g)]
                .map((match) => match[1] as string)
                .filter((param) => !NON_FILTERING.has(param));

            return params.length > 0
                ? { page: relative(PAGES_ROOT, file), params: [...new Set(params)].sort() }
                : null;
        })
        .filter((entry): entry is { page: string; params: string[] } => entry !== null);

    it('no page claims unconditional cacheability while reading a filter param', () => {
        // The failure message names the page and the params, because the fix
        // is always the same — swap `true` for a predicate — and the only
        // question is which params make the render specific.
        expect(
            offenders,
            `these pages are gated \`cacheable: true\` but read filter params:\n${offenders
                .map((o) => `  ${o.page} → ${o.params.join(', ')}`)
                .join('\n')}`
        ).toEqual([]);
    });

    it('finds pages at all, so an empty result means clean rather than broken', () => {
        // Without this, a bad glob or a renamed directory would make the guard
        // above pass vacuously — the exact way a static guard rots into
        // decoration.
        const pages = allPages();
        expect(pages.length).toBeGreaterThan(30);
        expect(
            pages.filter((file) => callArgsOf(readFileSync(file, 'utf8'), 'applyCacheHeaders'))
                .length
        ).toBeGreaterThan(20);
    });
});
