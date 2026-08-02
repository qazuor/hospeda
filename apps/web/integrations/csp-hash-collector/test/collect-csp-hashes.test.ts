/**
 * @file collect-csp-hashes.test.ts
 * @description Unit tests for the collectCspHashes HTML walker (HOS-369 WB0-1).
 *
 * The expected digests are computed with `node:crypto` — a DIFFERENT
 * implementation from the Web Crypto path the collector uses. A test that
 * re-used the collector's own hashing would prove only self-consistency, which
 * is exactly the failure mode spec risk R-9 describes (a hash that does not
 * match the emitted content blocks the script in the browser).
 *
 * AAA pattern. Fixtures live as string constants at the top of the file.
 */

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { collectCspHashes } from '../collect-csp-hashes';

/** Independent reference implementation of a CSP `sha256-` source token. */
const referenceHash = (source: string): string =>
    `sha256-${createHash('sha256').update(source, 'utf8').digest('base64')}`;

const FIXTURE_PLAIN_SCRIPT =
    '<!doctype html><html><body><script>console.log(1)</script></body></html>';

const FIXTURE_EXTERNAL_SCRIPT =
    '<!doctype html><html><body><script src="https://cdn.example.com/lib.js"></script></body></html>';

const FIXTURE_PLAIN_STYLE =
    '<!doctype html><html><head><style>body { color: red; }</style></head></html>';

const FIXTURE_SCRIPT_INSIDE_NOSCRIPT =
    '<!doctype html><html><body><noscript><script>fallback()</script></noscript></body></html>';

const FIXTURE_SCRIPT_WITH_STYLE_LITERAL =
    '<!doctype html><html><body><script>const html = "<style>foo</style>";</script></body></html>';

const FIXTURE_JSON_DATA_BLOCK =
    '<!doctype html><html><body><script type="application/json">{"a":1}</script></body></html>';

const FIXTURE_MALFORMED = '<!doctype html><html><body><script>oops()'; // unclosed script

const FIXTURE_DUPLICATES =
    '<!doctype html><html><head><style>a{}</style><style>a{}</style></head><body><script>d()</script><script>d()</script></body></html>';

const FIXTURE_MIXED =
    '<!doctype html><html><head><style>a{}</style><style>b{}</style></head><body><script src="/a.js"></script><script>c</script><script>d</script></body></html>';

describe('collectCspHashes', () => {
    it('hashes a plain inline <script> with the digest a browser would compute', async () => {
        const { scriptHashes } = await collectCspHashes({ html: FIXTURE_PLAIN_SCRIPT });

        expect(scriptHashes).toEqual([referenceHash('console.log(1)')]);
    });

    it('hashes a <style> block into styleHashes, not scriptHashes', async () => {
        const { scriptHashes, styleHashes } = await collectCspHashes({ html: FIXTURE_PLAIN_STYLE });

        expect(styleHashes).toEqual([referenceHash('body { color: red; }')]);
        expect(scriptHashes).toEqual([]);
    });

    it('does NOT hash an external <script src="...">', async () => {
        const { scriptHashes } = await collectCspHashes({ html: FIXTURE_EXTERNAL_SCRIPT });

        // External scripts are covered by `'self'`. A hash can only match one
        // that carries `integrity`, which Astro does not emit.
        expect(scriptHashes).toEqual([]);
    });

    it('does NOT hash <script>/<style> inside <noscript>', async () => {
        const { scriptHashes, styleHashes } = await collectCspHashes({
            html: FIXTURE_SCRIPT_INSIDE_NOSCRIPT
        });

        expect(scriptHashes).toEqual([]);
        expect(styleHashes).toEqual([]);
    });

    it('is not tricked by a literal <style> string inside a script body', async () => {
        const { scriptHashes, styleHashes } = await collectCspHashes({
            html: FIXTURE_SCRIPT_WITH_STYLE_LITERAL
        });

        expect(scriptHashes).toEqual([referenceHash('const html = "<style>foo</style>";')]);
        expect(styleHashes).toEqual([]);
    });

    it('hashes a non-executable data block too (defensive, see module JSDoc)', async () => {
        const { scriptHashes } = await collectCspHashes({ html: FIXTURE_JSON_DATA_BLOCK });

        expect(scriptHashes).toEqual([referenceHash('{"a":1}')]);
    });

    it('deduplicates identical inline blocks', async () => {
        const { scriptHashes, styleHashes } = await collectCspHashes({ html: FIXTURE_DUPLICATES });

        expect(scriptHashes).toEqual([referenceHash('d()')]);
        expect(styleHashes).toEqual([referenceHash('a{}')]);
    });

    it('hashes content VERBATIM — leading/trailing whitespace is part of the digest', async () => {
        // A browser hashes the element's child text exactly as it appears. Any
        // trimming here would produce a source expression that never matches.
        const source = '\n    console.log(1);\n  ';
        const { scriptHashes } = await collectCspHashes({
            html: `<!doctype html><html><body><script>${source}</script></body></html>`
        });

        expect(scriptHashes).toEqual([referenceHash(source)]);
        expect(scriptHashes).not.toEqual([referenceHash(source.trim())]);
    });

    it('does not throw on malformed (unclosed) HTML', async () => {
        await expect(collectCspHashes({ html: FIXTURE_MALFORMED })).resolves.toBeDefined();
    });

    it('returns empty lists for empty input', async () => {
        const { scriptHashes, styleHashes } = await collectCspHashes({ html: '' });

        expect(scriptHashes).toEqual([]);
        expect(styleHashes).toEqual([]);
    });

    it('skips an empty inline <script> (nothing to execute, nothing to allow)', async () => {
        const { scriptHashes } = await collectCspHashes({
            html: '<!doctype html><html><body><script></script></body></html>'
        });

        expect(scriptHashes).toEqual([]);
    });

    it('handles a mixed document: hashes inline blocks, skips externals, splits by kind', async () => {
        const { scriptHashes, styleHashes } = await collectCspHashes({ html: FIXTURE_MIXED });

        expect(styleHashes).toEqual([referenceHash('a{}'), referenceHash('b{}')]);
        expect(scriptHashes).toEqual([referenceHash('c'), referenceHash('d')]);
    });

    it('emits UNQUOTED sha256- tokens (the caller adds the CSP quoting)', async () => {
        const { scriptHashes } = await collectCspHashes({ html: FIXTURE_PLAIN_SCRIPT });

        for (const hash of scriptHashes) {
            expect(hash.startsWith('sha256-')).toBe(true);
            expect(hash).not.toContain("'");
        }
    });
});
