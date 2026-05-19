/**
 * @file inject-nonce.ts
 * @description Pure function that stamps a CSP nonce onto inline <style> and
 * <script> tags lacking one. Uses parse5 (already a transitive runtime dep of
 * apps/web via astro -> @astrojs/markdown-remark -> hast-util-from-html) so we
 * add zero new bundle weight.
 *
 * Skip rules:
 * - Tags that already have a nonce= attribute are left untouched.
 * - <script> and <style> descendants of <noscript> are NOT modified
 *   (their content is inert until noscript activates, and stamping them
 *   would mismatch the policy when the page is JS-disabled).
 *
 * External <script src="..."> tags DO receive the nonce. CSP3 strict-dynamic
 * requires it: an external script without a nonce will not be granted the
 * "transitively trusted" status that strict-dynamic propagates from
 * nonce-carrying ancestors.
 *
 * @see research/astro-csp-options.md §6 deliverable T-046-NONCE-INTEGRATION
 */

import { type DefaultTreeAdapterMap, parse, serialize } from 'parse5';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
type ParentNode = DefaultTreeAdapterMap['parentNode'];

interface InjectNonceArgs {
    readonly html: string;
    readonly nonce: string;
}

interface InjectNonceResult {
    readonly html: string;
}

/**
 * Returns the HTML with `nonce="${nonce}"` added to every <style> and
 * <script> tag that does not already have a nonce attribute. <noscript>
 * descendants are not modified.
 *
 * Returns the input unchanged when `nonce` is empty (no-op safety: a missing
 * nonce upstream should fail loud at the policy layer, not here).
 *
 * @param args - html: full HTML document or fragment; nonce: base64 token.
 * @returns Object with the rewritten html.
 */
export function injectNonce({ html, nonce }: InjectNonceArgs): InjectNonceResult {
    if (html.length === 0 || nonce.length === 0) {
        return { html };
    }
    const document = parse(html);
    walk(document, nonce, false);
    return { html: serialize(document) };
}

function walk(node: Node, nonce: string, insideNoscript: boolean): void {
    const tagName = getTagName(node);

    if (tagName === 'script' || tagName === 'style') {
        if (!insideNoscript) {
            stampNonce(node as Element, nonce);
        }
    }

    const nextInsideNoscript = insideNoscript || tagName === 'noscript';

    const children = getChildren(node);
    if (children) {
        for (const child of children) {
            walk(child, nonce, nextInsideNoscript);
        }
    }
}

function getTagName(node: Node): string | null {
    return 'tagName' in node ? node.tagName : null;
}

function getChildren(node: Node): ReadonlyArray<Node> | null {
    return 'childNodes' in node ? ((node as ParentNode).childNodes ?? null) : null;
}

function stampNonce(element: Element, nonce: string): void {
    const hasNonce = element.attrs.some((attr) => attr.name === 'nonce');
    if (hasNonce) return;
    element.attrs.push({ name: 'nonce', value: nonce });
}
