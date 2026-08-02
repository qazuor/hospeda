/**
 * @file collect-csp-hashes.ts
 * @description Pure function that computes the `sha256` of every inline
 * `<script>` and `<style>` in an HTML document, so the CSP header can allow
 * them by CONTENT instead of by a per-request nonce (HOS-369 WB0-1, spec §5.13
 * / D-9).
 *
 * Why hashes and not the previous nonce: Cloudflare caches headers with the
 * body, so a per-request nonce survives into the cache and becomes a static,
 * publicly readable token for the whole TTL — anyone can `GET` the page, read
 * it and reuse it, which collapses the inline-script protection HOS-30 phase 2
 * was built to provide. A hash is DERIVED from the content, so header and body
 * cannot desynchronize, cached or not.
 *
 * This is NOT Astro's native `security.csp` (rejected twice — SPEC-046 and
 * HOS-124 — because it drops `<ClientRouter />` support, moves the policy to
 * `<meta>` which cannot carry `report-uri`, and loses dev coverage). The
 * middleware stays the single CSP source; only what it stamps changed.
 *
 * Collection rules:
 * - Every inline `<script>` (no `src` attribute) with non-empty content is
 *   hashed, regardless of its `type`. Non-executable data blocks such as
 *   `<script type="application/json">` are not subject to `script-src` in any
 *   browser we target, so hashing them is redundant — but it costs one extra
 *   digest and ~50 header bytes, and it removes any chance of a blocked block
 *   or a spurious violation report if a browser ever disagrees.
 * - `<script src="...">` is NOT hashed. A hash can only match an external
 *   script when the tag carries an `integrity` attribute (CSP3 external-hash
 *   matching), which Astro does not emit and which browser support for is
 *   partial. External scripts are covered by `'self'` in `script-src` instead —
 *   which is why `'strict-dynamic'` had to go: with it present, browsers ignore
 *   `'self'` and every `/_astro/*.js` island bundle would be blocked.
 * - Every `<style>` block with non-empty content is hashed.
 * - `<noscript>` descendants are skipped. With parse5's default
 *   `scriptingEnabled: true` the content of `<noscript>` is parsed as raw text
 *   (so there are no element children to reach anyway); the explicit guard
 *   keeps the intent readable and holds if that ever changes.
 *
 * Hashes are deduplicated: identical inline blocks (the same `<style>` emitted
 * by two instances of one component) collapse to a single source expression.
 *
 * @see .specs/HOS-369-web-performance-edge-cache/spec.md §5.13, §6.3 (WB0-1)
 */

import { type DefaultTreeAdapterMap, parse } from 'parse5';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
type ParentNode = DefaultTreeAdapterMap['parentNode'];

interface CollectCspHashesArgs {
    readonly html: string;
}

interface CollectCspHashesResult {
    /** `sha256-…` source tokens (unquoted) for `script-src`. */
    readonly scriptHashes: readonly string[];
    /** `sha256-…` source tokens (unquoted) for `style-src`. */
    readonly styleHashes: readonly string[];
}

/**
 * Walks an HTML document and returns the CSP hash sources for its inline
 * `<script>` and `<style>` content.
 *
 * Tokens are returned UNQUOTED (`sha256-…`); the caller wraps them in single
 * quotes when assembling the directive.
 *
 * Returns empty lists for empty input (no-op safety: an empty body means there
 * is nothing to allow, and the policy layer should not be handed junk).
 *
 * @param args - html: full HTML document or fragment.
 * @returns Object with the deduplicated script and style hash sources.
 */
export async function collectCspHashes({
    html
}: CollectCspHashesArgs): Promise<CollectCspHashesResult> {
    if (html.length === 0) {
        return { scriptHashes: [], styleHashes: [] };
    }

    const scriptSources: string[] = [];
    const styleSources: string[] = [];

    const document = parse(html);
    walk(document, scriptSources, styleSources, false);

    const [scriptHashes, styleHashes] = await Promise.all([
        hashAll(scriptSources),
        hashAll(styleSources)
    ]);

    return { scriptHashes, styleHashes };
}

function walk(
    node: Node,
    scriptSources: string[],
    styleSources: string[],
    insideNoscript: boolean
): void {
    const tagName = getTagName(node);

    if (!insideNoscript && (tagName === 'script' || tagName === 'style')) {
        const element = node as Element;
        // External scripts are covered by `'self'`, not by a content hash.
        const isExternalScript = tagName === 'script' && hasAttribute(element, 'src');
        if (!isExternalScript) {
            const source = getRawText(element);
            if (source.length > 0) {
                (tagName === 'script' ? scriptSources : styleSources).push(source);
            }
        }
    }

    const nextInsideNoscript = insideNoscript || tagName === 'noscript';

    const children = getChildren(node);
    if (children) {
        for (const child of children) {
            walk(child, scriptSources, styleSources, nextInsideNoscript);
        }
    }
}

function getTagName(node: Node): string | null {
    return 'tagName' in node ? node.tagName : null;
}

function getChildren(node: Node): ReadonlyArray<Node> | null {
    return 'childNodes' in node ? ((node as ParentNode).childNodes ?? null) : null;
}

function hasAttribute(element: Element, name: string): boolean {
    return element.attrs.some((attr) => attr.name === name);
}

/**
 * Concatenates the raw text children of a `<script>`/`<style>` element.
 *
 * The value is used VERBATIM — no trimming, no normalization. A CSP hash is
 * computed over the element's child text exactly as it appears in the
 * document, so any "cleanup" here would produce a hash the browser never
 * matches (spec risk R-9).
 */
function getRawText(element: Element): string {
    let text = '';
    for (const child of element.childNodes) {
        if (child.nodeName === '#text' && 'value' in child) {
            text += child.value;
        }
    }
    return text;
}

/** Hashes each source, preserving first-seen order and dropping duplicates. */
async function hashAll(sources: readonly string[]): Promise<readonly string[]> {
    const hashes = await Promise.all(sources.map((source) => sha256Base64(source)));
    return [...new Set(hashes)];
}

/**
 * Computes the base64-encoded SHA-256 of a string's UTF-8 bytes, formatted as
 * a CSP hash source token (`sha256-…`, unquoted).
 *
 * Uses the Web Crypto API rather than `node:crypto` for parity with the rest
 * of the middleware helpers (which already use `crypto.getRandomValues`) and
 * so the module carries no Node-only dependency.
 */
async function sha256Base64(source: string): Promise<string> {
    const bytes = new TextEncoder().encode(source);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return `sha256-${bytesToBase64(new Uint8Array(digest))}`;
}

function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
}
