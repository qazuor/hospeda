/**
 * @file outbound-href-sanitization.ts
 * @description Shared scanner for HOS-592 — finds every place the web app puts a
 * value into an `href`, and says which of them point OUT of this site.
 *
 * WHY IT EXISTS. `resolveSafeExternalUrl` already existed, already had tests for
 * `javascript:alert(1)`, and was already applied to photo credits and to an
 * accommodation's contact block — and the partner page still shipped
 * `href={partner.websiteUrl}` raw, on a field a partner writes through a
 * session-only endpoint that `z.string().url()` happily accepts `javascript:`
 * for. That is the repo's third "canonical helper created, old call sites never
 * migrated" incident (`normalizeStoredSubscriptionStatus` and
 * `isEntitlementGrantingStatus` were the first two, and the second one killed
 * addon sales in production for months). Nine call sites had to be migrated by
 * hand; nothing in the suite could have named the tenth.
 *
 * So this asks a WHOLE-TREE question: of every `href` the app writes, which ones
 * leave the site, and is each of those fed by the one allow-list.
 *
 * ## The anchor
 *
 * The scan anchors on `href` followed by `=` or `:` — the token you cannot avoid
 * writing, whatever wraps it. That matters: the first sketch of this guard
 * anchored on `href={x.websiteUrl}`, which sees none of `href={url}`,
 * `href={`${base}/x`}`, `href="..."` in a template string, or the object
 * property form `{ href, rel, target }` that `partner-logo-link.ts` uses — and
 * that last one is one of the two sites the production finding was about.
 *
 * ## What makes a site "outbound"
 *
 * The element or object literal carrying the `href` also carries a marker that
 * says the link leaves this site: `target` set to `_blank`, or a `rel` naming
 * any of `noopener` / `noreferrer` / `nofollow` / `sponsored` / `external` /
 * `me`. Those markers are not decoration — an outbound link in this app is
 * REQUIRED to carry them (tabnabbing, and Google's sponsored-link policy), so
 * they are as close to inevitable as the `href` token itself.
 *
 * ## What it does NOT see, so a green run is not mistaken for more
 *
 * - An outbound link that carries neither `target="_blank"` nor any of the `rel`
 *   tokens. The companion field-name prong in the test file covers the realistic
 *   shape of that mistake (a known third-party URL field read into an `href`),
 *   but a value named nothing recognisable, linked with no outbound marker,
 *   passes. It also renders as a same-tab navigation to a third-party site with
 *   no `noopener`, which is its own defect and would not survive review.
 * - Provenance. A static scan cannot know whether `href={item.href}` holds a
 *   value a stranger typed. That is what {@link SANITIZED_BY} and the test's
 *   allow-list are for: each unproven outbound site must be written down with
 *   the reason it is safe, so the claim is reviewable instead of assumed.
 * - Anything outside `apps/web/src`. The admin app builds its own links and is
 *   behind an authenticated panel; it is not in scope here.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** The one helper allowed to decide that a third-party URL may be linked. */
export const SANITIZER = 'resolveSafeExternalUrl';

/**
 * A single place the source writes an `href`.
 */
export interface LinkSite {
    /** Path relative to `apps/web/src`, always with `/` separators. */
    readonly file: string;
    /** 1-based line number, so a failure message points somewhere. */
    readonly line: number;
    /** The value written into the `href`, verbatim and whitespace-collapsed. */
    readonly expression: string;
    /** The enclosing tag or object literal, used to detect outbound markers. */
    readonly owner: string;
}

/** `rel` tokens that only ever appear on a link pointing off this site. */
const OUTBOUND_REL_TOKENS: readonly string[] = [
    'noopener',
    'noreferrer',
    'nofollow',
    'sponsored',
    'external',
    'me'
];

/**
 * How the source says "this link leaves the site".
 *
 * The marker is looked for ANYWHERE inside the attribute's value, not only at
 * its start: `target={isExternal ? '_blank' : undefined}` is a real shape in
 * this tree (`TradeCard.tsx`), and the first draft of this predicate — which
 * required the value to BEGIN with `_blank` — read that link as internal. A
 * host-authored contact URL was hiding behind exactly that.
 */
const OUTBOUND_MARKERS: readonly RegExp[] = [
    /\btarget\s*[=:][^>]{0,240}?_blank/s,
    new RegExp(`\\brel\\s*[=:][^>]{0,240}?\\b(${OUTBOUND_REL_TOKENS.join('|')})\\b`, 's')
];

/** How far around an object-literal `href:` to look for its siblings. */
const OBJECT_OWNER_WINDOW = 400;

/** Extensions that can contain a rendered link. */
const SOURCE_EXTENSIONS = /\.(ts|tsx|astro)$/;

/**
 * The inevitable token: `href` bound to a value.
 *
 * `=(?!=)` is load-bearing — without it `isExternalLink(next.href === …)` in
 * `sanitize-html.ts` reads as a link whose "value" is `== 'string' && …`. A
 * comparison is not a link.
 */
const HREF_ANCHOR = /\bhref\s*(?:=(?!=)|:)\s*/g;

/**
 * A TypeScript type annotation, not a value.
 *
 * `readonly href: string` in an interface matches the anchor exactly as a
 * property assignment does. Rather than teach the scanner to parse
 * declarations, the handful of shapes a URL field is ever TYPED as are named
 * here — and none of them is a legal expression that could carry a URL, so
 * nothing real hides behind this.
 */
/**
 * A local binding that merely happens to be named `href`.
 *
 * `const href = anchor.href;` matches the anchor exactly as an attribute does,
 * and it is not a link — the link is wherever that variable is later rendered,
 * which the scan sees on its own. Skipping declarations therefore loses no
 * coverage; keeping them only produces noise that would have to be exempted.
 */
const DECLARATION_BEFORE_HREF = /\b(const|let|var)\s+$/;

const TYPE_ANNOTATION =
    /^(readonly\s+)?(string|number|boolean|URL|unknown|never|null|undefined)(\s*\|\s*(string|number|boolean|null|undefined))*\s*;?$/;

/**
 * Collects every source file under a directory, recursively.
 *
 * @param dir - Absolute directory to walk.
 * @returns Absolute paths of every scannable file below it.
 */
export function collectSourceFiles(dir: string): readonly string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            out.push(...collectSourceFiles(full));
        } else if (SOURCE_EXTENSIONS.test(entry)) {
            out.push(full);
        }
    }
    return out;
}

/**
 * Reads a balanced `{ … }` expression starting at an opening brace.
 *
 * Quotes and template literals are skipped over so a `>` or a `}` inside a
 * string never ends the read early — which is exactly what breaks the naive
 * `/<a[^>]*>/` approach on a tag like `href={cond ? `/${a}` : '#'}`.
 *
 * @param source - Whole file.
 * @param open - Index of the `{`.
 * @returns Index just past the matching `}`, or `source.length` if unbalanced.
 */
function readBalancedBraces(source: string, open: number): number {
    let depth = 0;
    let quote: string | undefined;
    for (let i = open; i < source.length; i += 1) {
        const char = source[i];
        if (quote) {
            if (char === '\\') {
                i += 1;
            } else if (char === quote) {
                quote = undefined;
            }
            continue;
        }
        if (char === '"' || char === "'" || char === '`') {
            quote = char;
            continue;
        }
        if (char === '{') {
            depth += 1;
        } else if (char === '}') {
            depth -= 1;
            if (depth === 0) {
                return i + 1;
            }
        }
    }
    return source.length;
}

/**
 * Reads a quoted string starting at its opening quote.
 *
 * @param source - Whole file.
 * @param open - Index of the quote character.
 * @returns Index just past the closing quote.
 */
function readQuoted(source: string, open: number): number {
    const quote = source[open];
    for (let i = open + 1; i < source.length; i += 1) {
        if (source[i] === '\\') {
            i += 1;
            continue;
        }
        if (source[i] === quote) {
            return i + 1;
        }
    }
    return source.length;
}

/**
 * Extracts the tag that owns an attribute at `index`, if there is one.
 *
 * Scans back to the nearest `<` that opens an element, then forward — tracking
 * braces and quotes — to the `>` that closes that tag. Returns `undefined` when
 * the recovered tag does not actually contain `index`, which is how an object
 * property (`{ href: … }`) and a template-string link fall through to the
 * window-based owner instead of borrowing a neighbour's attributes.
 *
 * @param source - Whole file.
 * @param index - Index of the `href` token.
 * @returns The tag's source text, or `undefined`.
 */
function extractOwnerTag(source: string, index: number): string | undefined {
    let start = -1;
    for (let i = index; i >= 0; i -= 1) {
        if (source[i] === '<' && /[A-Za-z]/.test(source[i + 1] ?? '')) {
            start = i;
            break;
        }
        if (source[i] === '>') {
            // A closed tag sits between us and any opener: this `href` is not
            // an attribute of an element at all.
            return undefined;
        }
    }
    if (start === -1) return undefined;

    let quote: string | undefined;
    for (let i = start; i < source.length; i += 1) {
        const char = source[i];
        if (quote) {
            if (char === '\\') {
                i += 1;
            } else if (char === quote) {
                quote = undefined;
            }
            continue;
        }
        if (char === '"' || char === "'" || char === '`') {
            quote = char;
            continue;
        }
        if (char === '{') {
            i = readBalancedBraces(source, i) - 1;
            continue;
        }
        if (char === '>') {
            return i >= index ? source.slice(start, i + 1) : undefined;
        }
    }
    return undefined;
}

/** Collapses runs of whitespace so an expression is comparable and printable. */
function collapse(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

/**
 * Finds every `href` written in one file.
 *
 * @param source - File contents.
 * @param file - Path used in the returned sites.
 * @returns One entry per `href`, in source order.
 */
export function findLinkSites(source: string, file: string): readonly LinkSite[] {
    const sites: LinkSite[] = [];
    const anchor = HREF_ANCHOR;
    anchor.lastIndex = 0;
    let match: RegExpExecArray | null = anchor.exec(source);

    while (match !== null) {
        if (DECLARATION_BEFORE_HREF.test(source.slice(Math.max(0, match.index - 8), match.index))) {
            anchor.lastIndex = match.index + match[0].length;
            match = anchor.exec(source);
            continue;
        }

        const valueStart = match.index + match[0].length;
        const char = source[valueStart];

        let valueEnd: number;
        if (char === '{') {
            valueEnd = readBalancedBraces(source, valueStart);
        } else if (char === '"' || char === "'" || char === '`') {
            valueEnd = readQuoted(source, valueStart);
        } else {
            // Object property without a wrapper: `href: someVar,`.
            const rest = source.slice(valueStart);
            const stop = rest.search(/[,}\n]/);
            valueEnd = valueStart + (stop === -1 ? rest.length : stop);
        }

        const owner =
            extractOwnerTag(source, match.index) ??
            source.slice(
                Math.max(0, match.index - OBJECT_OWNER_WINDOW),
                Math.min(source.length, valueEnd + OBJECT_OWNER_WINDOW)
            );

        const expression = collapse(source.slice(valueStart, valueEnd));
        if (TYPE_ANNOTATION.test(expression)) {
            anchor.lastIndex = valueEnd;
            match = anchor.exec(source);
            continue;
        }

        sites.push({
            file,
            line: source.slice(0, match.index).split('\n').length,
            expression,
            owner
        });

        anchor.lastIndex = valueEnd;
        match = anchor.exec(source);
    }

    return sites;
}

/**
 * Whether a link site points off this site.
 *
 * @param site - A site from {@link findLinkSites}.
 * @returns `true` when the owner carries an outbound marker.
 */
export function isOutbound(site: LinkSite): boolean {
    return OUTBOUND_MARKERS.some((marker) => marker.test(site.owner));
}

/**
 * Whether the value in this `href` demonstrably came from the sanitizer.
 *
 * Two proofs are accepted, and only two:
 *
 * 1. The expression calls it inline — `href={resolveSafeExternalUrl(x)}`.
 * 2. The expression is a bare identifier that this same file binds to a
 *    sanitizer call — the `const websiteHref = resolveSafeExternalUrl(…)` shape
 *    `AccommodationContactBlock.astro` established.
 *
 * A member expression (`credit.url`, `link.href`) is deliberately NOT resolved:
 * its origin is in another file, or in a prop, and a scan that guessed would be
 * guessing. Those go in the test's allow-list with a written reason.
 *
 * @param site - A site from {@link findLinkSites}.
 * @param source - The file the site came from.
 * @returns `true` when the value provably passed the allow-list.
 */
export function isSanitized(site: LinkSite, source: string): boolean {
    if (site.expression.includes(`${SANITIZER}(`)) {
        return true;
    }

    const identifier = site.expression.match(/^\{?\s*([A-Za-z_$][\w$]*)\s*\}?$/)?.[1];
    if (!identifier) return false;

    const binding = new RegExp(
        `\\b${identifier}\\s*(?::[^=\\n]+)?=\\s*${SANITIZER}\\(|\\b${identifier}\\s*:\\s*${SANITIZER}\\(`
    );
    return binding.test(source);
}

/**
 * Scans a whole tree and returns the outbound sites that are not provably
 * sanitized.
 *
 * @param root - Absolute path of `apps/web/src`.
 * @returns Unproven outbound sites, keyed by `file#expression` in the report.
 */
export function findUnprovenOutboundSites(root: string): readonly LinkSite[] {
    const unproven: LinkSite[] = [];
    for (const absolute of collectSourceFiles(root)) {
        const source = readFileSync(absolute, 'utf8');
        const file = relative(root, absolute).split(sep).join('/');
        for (const site of findLinkSites(source, file)) {
            if (isOutbound(site) && !isSanitized(site, source)) {
                unproven.push(site);
            }
        }
    }
    return unproven;
}

/** The stable key an allow-list entry is written against. */
export function siteKey(site: LinkSite): string {
    return `${site.file}#${site.expression}`;
}
