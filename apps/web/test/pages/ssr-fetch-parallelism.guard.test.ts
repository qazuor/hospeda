/**
 * @fileoverview HOS-369 W2-5 guard: the accommodation pages must not await
 * independent API reads one after the other.
 *
 * Sequential `await`s stack one round-trip of latency per call into TTFB. On
 * these two pages the calls were genuinely independent — every argument comes
 * from `url.searchParams` or from the already-resolved accommodation — so the
 * serialisation bought nothing.
 *
 * This matters *despite* the edge cache rather than because of it. A cached
 * page never runs its frontmatter, so the only requests that pay this cost are
 * the ones the cache cannot serve: the first hit after a TTL expiry or a purge,
 * and every `stale-while-revalidate` refresh. Those are exactly the requests
 * whose latency the cache was supposed to hide.
 *
 * The check counts bare `await <name>Api.<method>(` in the frontmatter. Reads
 * inside a `Promise.all` / `Promise.allSettled` array are not awaited
 * individually, so they do not match — which is the property being asserted.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGES_ROOT = resolve(__dirname, '../../src/pages/[lang]');

/**
 * The frontmatter — everything between the opening `---` line and the closing
 * one, both alone on their line.
 *
 * Deliberately NOT `source.split('---')[1]`: comment banners like
 * `// --- Parallel secondary fetches ---` contain the fence, so the naive split
 * truncates at the first one and hides everything after it. Both pages guarded
 * here carry exactly such a banner, so the naive version would read a fraction
 * of each file and pass on the strength of what it never looked at.
 */
function frontmatter(source: string): string {
    const lines = source.split('\n');
    if (lines[0]?.trim() !== '---') return source;
    for (let i = 1; i < lines.length; i++) {
        if (lines[i]?.trimEnd() === '---') return lines.slice(1, i).join('\n');
    }
    return source;
}

/** Bare `await someApi.method(` occurrences — i.e. reads awaited on their own. */
function individuallyAwaitedApiReads(source: string): readonly string[] {
    const matches = frontmatter(source).matchAll(/await\s+(\w*[aA]pi)\.(\w+)\s*\(/g);
    return [...matches].map((m) => `${m[1]}.${m[2]}`);
}

const read = (relPath: string) => readFileSync(resolve(PAGES_ROOT, relPath), 'utf8');

describe('accommodation SSR fetches run in parallel (HOS-369 W2-5)', () => {
    it('the listing awaits no API read on its own', () => {
        const serialised = individuallyAwaitedApiReads(read('alojamientos/index.astro'));

        expect(
            serialised,
            `These reads are awaited individually instead of joining the Promise.all, so each one adds a round-trip to TTFB on every cache miss: ${serialised.join(', ')}.`
        ).toEqual([]);
    });

    it('the detail page awaits only the lookup everything else depends on', () => {
        // `getBySlug` is legitimately sequential: it resolves the entity whose
        // id and destination every other call is keyed by. Two waves is the
        // floor here, not a defect — so this asserts the exact set rather than
        // an empty one, and a THIRD wave creeping back in still fails.
        const serialised = individuallyAwaitedApiReads(read('alojamientos/[slug].astro'));

        expect(serialised).toEqual(['accommodationsApi.getBySlug']);
    });

    it('both pages actually batch their reads — the guard is not reading an empty file', () => {
        // Without this, a renamed page or a broken frontmatter parse yields an
        // empty match set, which satisfies `toEqual([])` above while checking
        // nothing at all.
        for (const page of ['alojamientos/index.astro', 'alojamientos/[slug].astro']) {
            const fm = frontmatter(read(page));
            expect(fm.length, `${page}: frontmatter parsed as empty`).toBeGreaterThan(1000);
            expect(fm, `${page}: no batched read found`).toMatch(/Promise\.all(Settled)?\(/);
        }
    });
});
