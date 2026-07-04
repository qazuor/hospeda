/**
 * Robust JSON-LD block extraction from HTML using a spec-compliant parser.
 *
 * This replaces the earlier regex-based `<script type="application/ld+json">`
 * matching that lived (duplicated) across the accommodation-import extractor
 * and the external-reputation adapters. That regex was flagged by CodeQL
 * `js/bad-tag-filter`: regular expressions cannot reliably match HTML tags —
 * an attribute value containing `>` (e.g. `data-x="a>b"`) or unusual
 * whitespace in the closing tag silently breaks the match and drops the block.
 *
 * parse5 is the WHATWG-compliant HTML parser already used by `apps/web`
 * (CSP nonce injector), so this consolidates on an existing, vetted monorepo
 * dependency rather than introducing a new class of parser.
 *
 * @module utils/html-jsonld
 */

import { type DefaultTreeAdapterMap, parse } from 'parse5';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
type ParentNode = DefaultTreeAdapterMap['parentNode'];

/**
 * Parses `html` and returns the `JSON.parse`d content of every
 * `<script type="application/ld+json">` block, in document order.
 *
 * Blocks whose content is empty or not valid JSON are silently skipped — a
 * malformed block never aborts extraction. This function never throws.
 *
 * @param input - `html`: the full HTML body to scan.
 * @returns Array of parsed JSON values (unknown shape), one per valid block.
 *
 * @example
 * ```ts
 * const blocks = parseJsonLdBlocks({ html: pageHtml });
 * for (const block of blocks) {
 *   // narrow `block` (unknown) before use
 * }
 * ```
 */
export function parseJsonLdBlocks(input: { readonly html: string }): unknown[] {
    const { html } = input;
    if (html.length === 0) {
        return [];
    }

    // parse5 is spec-compliant and does not throw on malformed markup, but we
    // guard defensively so this helper's "never throws" contract (relied on by
    // extractJsonLd and the reputation adapters) is locally true, not inherited
    // from caller try/catch discipline.
    let document: Node;
    try {
        document = parse(html);
    } catch {
        return [];
    }

    const out: unknown[] = [];
    for (const raw of collectLdJsonScriptContents(document)) {
        const trimmed = raw.trim();
        if (trimmed.length === 0) {
            continue;
        }
        try {
            out.push(JSON.parse(trimmed));
        } catch {
            // Malformed JSON — skip this block, continue to the next.
        }
    }
    return out;
}

/**
 * Walks the parse5 tree (iteratively, to avoid deep recursion on pathological
 * inputs) and collects the raw text content of every `<script>` element whose
 * `type` attribute is `application/ld+json` (case-insensitive, whitespace
 * around the value ignored).
 */
function collectLdJsonScriptContents(root: Node): string[] {
    const contents: string[] = [];
    const stack: Node[] = [root];

    for (;;) {
        const node = stack.pop();
        if (node === undefined) {
            break;
        }

        if (isLdJsonScript(node)) {
            contents.push(textContentOf(node));
        }

        const children = getChildNodes(node);
        if (children) {
            // Push in reverse so children pop in document order (LIFO stack).
            for (let i = children.length - 1; i >= 0; i--) {
                stack.push(children[i] as Node);
            }
        }
    }

    return contents;
}

/**
 * Type guard: `true` when `node` is a `<script type="application/ld+json">`.
 */
function isLdJsonScript(node: Node): node is Element {
    if (!('tagName' in node) || node.tagName !== 'script') {
        return false;
    }
    const typeAttr = (node as Element).attrs.find((attr) => attr.name === 'type');
    if (typeAttr === undefined) {
        return false;
    }
    return typeAttr.value.trim().toLowerCase() === 'application/ld+json';
}

/**
 * Concatenates the text of a script element's child text nodes. parse5 exposes
 * an inline script body as `#text` children carrying a string `value` (script
 * is a raw-text element, so its content is never sub-parsed into markup).
 */
function textContentOf(node: Node): string {
    const children = getChildNodes(node);
    if (!children) {
        return '';
    }
    let text = '';
    for (const child of children) {
        if ('value' in child && typeof child.value === 'string') {
            text += child.value;
        }
    }
    return text;
}

/**
 * Returns a node's child nodes when it is a parent node, otherwise `null`.
 */
function getChildNodes(node: Node): ReadonlyArray<Node> | null {
    return 'childNodes' in node ? ((node as ParentNode).childNodes ?? null) : null;
}
