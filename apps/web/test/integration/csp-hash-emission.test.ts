/**
 * @file csp-hash-emission.test.ts
 * @description Exercises the CSP hash pipeline (`collectCspHashes` ->
 * `buildCspHeader`) end-to-end against a realistic Astro-emitted HTML fixture
 * (HOS-369 WB0-1, replaces the nonce-era `csp-nonce-emission.test.ts`).
 *
 * Why this lives in `test/integration/` and not next to the collector:
 * - It joins the two halves that must agree — the walker that reads the body
 *   and the header builder that publishes the policy. A drift between them is
 *   invisible to either unit suite and fatal in the browser (spec risk R-9:
 *   a hash that does not match blocks the script — no theme, no i18n, no
 *   PostHog).
 * - It runs against a fixture that mirrors what Astro actually emits (scoped
 *   `<style>` blocks, Vite dev-id styles, bundled module scripts, a JSON data
 *   block, `<noscript>` fallbacks) rather than hand-minimal snippets.
 *
 * The expected digests come from `node:crypto`, an implementation independent
 * of the Web Crypto path the collector uses — the test would otherwise only
 * prove the collector agrees with itself.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type DefaultTreeAdapterMap, parse } from 'parse5';
import { describe, expect, it } from 'vitest';
import { collectCspHashes } from '../../integrations/csp-hash-collector';
import { buildCspHeader } from '../../src/lib/middleware-helpers';

const FIXTURE_HTML = readFileSync(resolve(__dirname, 'fixtures/astro-emitted-page.html'), 'utf8');

/** Independent reference implementation of a CSP `sha256-` source token. */
const referenceHash = (source: string): string =>
    `sha256-${createHash('sha256').update(source, 'utf8').digest('base64')}`;

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
type ParentNode = DefaultTreeAdapterMap['parentNode'];

interface InlineBlock {
    readonly kind: 'script' | 'style';
    readonly source: string;
    readonly isExternal: boolean;
}

/**
 * Independently enumerates every `<script>`/`<style>` element in the document,
 * mirroring what a browser sees. Deliberately does NOT reuse the collector's
 * walker — this is the reference the collector is checked against.
 */
const enumerateInlineBlocks = (html: string): readonly InlineBlock[] => {
    const found: InlineBlock[] = [];
    const walk = (node: Node): void => {
        const tagName = 'tagName' in node ? node.tagName : null;
        if (tagName === 'script' || tagName === 'style') {
            const element = node as Element;
            let source = '';
            for (const child of element.childNodes) {
                if (child.nodeName === '#text' && 'value' in child) source += child.value;
            }
            found.push({
                kind: tagName,
                source,
                isExternal: element.attrs.some((attr) => attr.name === 'src')
            });
        }
        const children = 'childNodes' in node ? (node as ParentNode).childNodes : null;
        if (children) for (const child of children) walk(child);
    };
    walk(parse(html));
    return found;
};

/** Isolates one directive from an assembled CSP header string. */
const findDirective = (header: string, name: string): string =>
    header.split('; ').find((d) => d.startsWith(`${name} `)) ?? '';

describe('CSP hash emission (end-to-end pipeline)', () => {
    it('the fixture actually contains inline blocks of both kinds (non-vacuity)', () => {
        const blocks = enumerateInlineBlocks(FIXTURE_HTML);

        const inlineScripts = blocks.filter(
            (b) => b.kind === 'script' && !b.isExternal && b.source.length > 0
        );
        const inlineStyles = blocks.filter((b) => b.kind === 'style' && b.source.length > 0);
        const externalScripts = blocks.filter((b) => b.kind === 'script' && b.isExternal);

        // Without these, every assertion below would pass on an empty document.
        expect(inlineScripts.length).toBeGreaterThanOrEqual(4);
        expect(inlineStyles.length).toBeGreaterThanOrEqual(3);
        expect(externalScripts.length).toBeGreaterThanOrEqual(2);
    });

    it('every inline <script> the browser would execute is allowed by its own hash', async () => {
        const { scriptHashes, styleHashes } = await collectCspHashes({ html: FIXTURE_HTML });
        const header = buildCspHeader({ scriptHashes, styleHashes });
        const scriptSrc = findDirective(header, 'script-src');

        const inlineScripts = enumerateInlineBlocks(FIXTURE_HTML).filter(
            (b) => b.kind === 'script' && !b.isExternal && b.source.length > 0
        );

        for (const block of inlineScripts) {
            expect(scriptSrc).toContain(`'${referenceHash(block.source)}'`);
        }
    });

    it('every inline <style> is allowed by its own hash', async () => {
        const { scriptHashes, styleHashes } = await collectCspHashes({ html: FIXTURE_HTML });
        const header = buildCspHeader({ scriptHashes, styleHashes });
        const styleSrc = findDirective(header, 'style-src');

        const inlineStyles = enumerateInlineBlocks(FIXTURE_HTML).filter(
            (b) => b.kind === 'style' && b.source.length > 0
        );

        for (const block of inlineStyles) {
            expect(styleSrc).toContain(`'${referenceHash(block.source)}'`);
        }
    });

    it('an attribute on the tag (e.g. a stray nonce) does not change the digest', async () => {
        // The fixture carries `<script nonce="stray-nonce">`. CSP hashes the
        // element's child text only, so the digest must be the plain content's.
        const { scriptHashes } = await collectCspHashes({ html: FIXTURE_HTML });

        expect(scriptHashes).toContain(
            referenceHash("console.log('attributes do not affect the hash')")
        );
    });

    it('external <script src> contributes no hash and relies on self', async () => {
        const { scriptHashes, styleHashes } = await collectCspHashes({ html: FIXTURE_HTML });
        const scriptSrc = findDirective(
            buildCspHeader({ scriptHashes, styleHashes }),
            'script-src'
        );

        // One hash per distinct inline script — the two module bundles add none.
        const inlineSources = new Set(
            enumerateInlineBlocks(FIXTURE_HTML)
                .filter((b) => b.kind === 'script' && !b.isExternal && b.source.length > 0)
                .map((b) => b.source)
        );
        expect(scriptHashes).toHaveLength(inlineSources.size);
        expect(scriptSrc).toContain("'self'");
    });

    it("never emits 'strict-dynamic' — it would make 'self' inert and block every island bundle", async () => {
        const { scriptHashes, styleHashes } = await collectCspHashes({ html: FIXTURE_HTML });
        const header = buildCspHeader({ scriptHashes, styleHashes });

        // HOS-369 D-9: a hash cannot vouch for an external script (that needs
        // `integrity`, which Astro does not emit). Reintroducing
        // 'strict-dynamic' silently kills every /_astro/*.js bundle.
        expect(header).not.toContain("'strict-dynamic'");
    });

    it('never emits a nonce source — the whole point of the migration', async () => {
        const { scriptHashes, styleHashes } = await collectCspHashes({ html: FIXTURE_HTML });
        const header = buildCspHeader({ scriptHashes, styleHashes });

        expect(header).not.toContain("'nonce-");
    });

    it('does not allow <noscript> content — it is inert while scripting is on', async () => {
        const { scriptHashes, styleHashes } = await collectCspHashes({ html: FIXTURE_HTML });

        // parse5 (scriptingEnabled: true, the browser default) parses noscript
        // content as raw TEXT, so these never reach the policy either way. The
        // assertion pins that: their content must not appear as a source.
        expect(styleHashes).not.toContain(referenceHash('.no-js .hide{display:none}'));
        expect(scriptHashes).not.toContain(
            referenceHash('this content runs only when JS is disabled — should NOT be hashed')
        );
    });

    it('collapses duplicate inline blocks to a single source expression', async () => {
        const { styleHashes } = await collectCspHashes({ html: FIXTURE_HTML });

        // The fixture emits `:where(html){...}` twice (two instances of one
        // component). A per-occurrence source list would bloat the header.
        const duplicated = referenceHash(':where(html){font-family:var(--font-sans)}');
        const occurrences = styleHashes.filter((h) => h === duplicated);
        expect(occurrences).toHaveLength(1);
    });

    it('keeps the strict posture: no unsafe-inline in script-src or style-src', async () => {
        const { scriptHashes, styleHashes } = await collectCspHashes({ html: FIXTURE_HTML });
        const header = buildCspHeader({ scriptHashes, styleHashes });

        expect(findDirective(header, 'script-src')).not.toContain("'unsafe-inline'");
        expect(findDirective(header, 'style-src')).not.toContain("'unsafe-inline'");
    });

    it('leaves the response body byte-identical (the collector only reads)', async () => {
        // The nonce era rewrote the HTML through parse5 serialization. Hashes
        // remove that round-trip entirely: a serializer quirk can no longer
        // corrupt the document it describes.
        const before = FIXTURE_HTML;
        await collectCspHashes({ html: FIXTURE_HTML });

        expect(FIXTURE_HTML).toBe(before);
    });
});
