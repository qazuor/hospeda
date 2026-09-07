/**
 * @file check-dialog-panel.ts
 * @description HOS-958 — fails CI when a dialog in `apps/web` can grow taller
 * than the window with no way to scroll it.
 *
 * Six dialog surfaces used to declare neither `max-height` nor `overflow`.
 * Nothing caught that, because nothing in the repo said what a dialog in this
 * app is supposed to do: each one re-decided its own cap (`90vh` here,
 * `min(90vh, 48rem)` there, `70vh` elsewhere) and the ones that decided
 * nothing looked fine with the test account and became unusable with a real
 * one. The shared `.dialog-panel` / `.dialog-panel-scroll` / `.dialog-viewport`
 * classes in `apps/web/src/styles/components.css` are the answer; this guard is
 * what keeps the inventory from filling back up.
 *
 * ## What it asserts
 *
 * 1. Every `<dialog>` element under `apps/web/src` carries `dialog-panel` or
 *    `dialog-viewport` in its own opening tag.
 * 2. `dialog-viewport` — the one shape where the `<dialog>` itself carries no
 *    cap, because it is a full-viewport overlay or drawer that hands the cap to
 *    a child — is count-pinned per file. A new one has to be argued for in a
 *    diff to this file rather than typed.
 * 3. `components.css` still defines all three classes. Without this the guard
 *    would keep passing after someone renamed or deleted the mechanism, which
 *    is precisely the failure mode of a guard anchored on a name.
 * 4. The shared `Dialog` primitive still composes the mechanism. It renders a
 *    portalled `<div role="dialog">`, never a `<dialog>` element, so rule 1 is
 *    structurally blind to the most widely used dialog in the app.
 * 5. It found a non-zero number of dialogs at all. A scan that silently matches
 *    nothing — wrong cwd, moved directory, a renamed extension — reports "no
 *    violations" in exactly the same words as a clean tree.
 * 6. No CSS Module re-declares `max-height` / `max-block-size` / `overflow` /
 *    `overflow-y` on a class that is applied to an element carrying
 *    `dialog-panel` or `dialog-viewport`. Rules 1-5 only prove the marker is
 *    present; this one proves it still does something. A module declaring
 *    `max-height: 3000px` beside the shared class does not override it, it
 *    RACES it at equal specificity — and a 3000px cap in a 640px window is no
 *    cap at all, with every other assertion still green.
 * 6b. The same rule on `dialog-panel-scroll`, for every call site whose
 *    `className` expression can be resolved without guessing. Breaking the
 *    scroll region reaches the user as the same bug from the other half of the
 *    mechanism: the panel obeys its cap, the content inside it is cut off, and
 *    the buttons are unreachable again. Expressions that branch are skipped and
 *    COUNTED in the success line, never skipped silently.
 *
 * 7. Every `<dialog>` in a workspace package `apps/web` depends on is bounded
 *    to the viewport and has something inside it that scrolls. `@repo/feedback`
 *    puts one on every page of the site and it lives outside `apps/web/src`,
 *    where assertions 1-6 cannot see it. The rule is deliberately weaker there
 *    — see below.
 * 8. Every `dialog-panel-scroll` region sits inside a flex or grid parent.
 *    `.dialog-panel` does not declare `display`, so a `<dialog>` is `block`
 *    unless its module says otherwise, and `flex: 1 1 auto; min-height: 0` on a
 *    child of a block parent does exactly nothing: the region does not scroll,
 *    the whole panel does, and the header the arrangement exists to pin scrolls
 *    away with it. Nothing about that is visible in a diff, a type, or a test.
 *
 * ## Why assertion 7 asks for less
 *
 * A shared package cannot compose `.dialog-panel`: the class lives in
 * `apps/web`'s global stylesheet and would not exist in another host, so
 * demanding it would be demanding a bug. What assertion 7 asks instead is true
 * of any usable dialog anywhere and needs no shared vocabulary: a height bound
 * (a `max-height` that is not `none`, or a viewport-relative `height`) and an
 * `overflow-y: auto|scroll` somewhere in the package's stylesheet. It will not
 * accept a dialog bounded by nothing, which is the state six of this app's own
 * dialogs were in. It deliberately does NOT try to prove the scrolling element
 * is inside the dialog — that would need cross-file structure the package does
 * not expose — so it is a floor, not a proof.
 *
 * ## Scope of rule 6, and why it does not block a legitimate `max-height`
 *
 * It never looks at a file, a directory, or a property name in isolation. It
 * starts from the `className` expressions that actually carry a marker, reads
 * which `styles.X` bindings those expressions use, resolves the module each
 * binding was imported from, and inspects only the rules whose SUBJECT compound
 * is that class. A `max-height` on a popover, a drawer, a thumbnail or a list —
 * anywhere the mechanism is not applied — is never even read. Tuning through
 * `--dialog-max-height` stays legal: the forbidden set is matched on exact
 * property names, and a custom property is not one of them.
 *
 * ## Why it is anchored where it is
 *
 * On the literal `<dialog` token, which is the one thing a native dialog
 * cannot be written without. Not on a component name, a file path, or a CSS
 * Module class — every one of those survives a rename while the guard quietly
 * stops matching, and the pull request doing the renaming never sees it fail.
 *
 * Run: `pnpm check:dialog-panel`
 */

import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'glob';

const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const WEB_SRC = resolve(REPO_ROOT, 'apps/web/src');
const COMPONENTS_CSS = resolve(WEB_SRC, 'styles/components.css');
const DIALOG_PRIMITIVE = resolve(WEB_SRC, 'components/shared/ui/Dialog.client.tsx');

/** The classes that make up the shared mechanism, as declared in components.css. */
const MECHANISM_CLASSES = ['dialog-panel', 'dialog-panel-scroll', 'dialog-viewport'] as const;

/**
 * Files allowed to mark a `<dialog>` with `dialog-viewport` instead of capping
 * it, and how many such dialogs each may hold. These are the `<dialog>`
 * elements that are NOT the panel: a full-viewport overlay wrapping a centred
 * card, or an edge-anchored drawer. The cap lives on a child in each case.
 *
 * Count-pinned on purpose — an exemption nobody has to justify is how a
 * fail-open gets in. Adding an entry here is a reviewable act.
 */
const VIEWPORT_BUDGET: ReadonlyMap<string, number> = new Map([
    // The <dialog> is the dimmed overlay; `.modalCard` below it carries the cap.
    ['apps/web/src/components/account/WhatsNewModal.client.tsx', 1],
    // Same overlay, side-panel layout; `.panel` below it carries the cap.
    ['apps/web/src/components/account/WhatsNewPanel.client.tsx', 1],
    // Edge-anchored full-height drawer; the filter panel inside it scrolls.
    ['apps/web/src/components/shared/filters/components/MobileDrawer.tsx', 1],
    // The <dialog> is the centring overlay; `.iconChipsDialogPanel` caps at 70dvh.
    ['apps/web/src/components/shared/filters/filter-types/IconChipsFilter.tsx', 1]
]);

/**
 * Properties a CSS Module may NOT declare on an element that carries the shared
 * mechanism. Each of these is the shared class's own declaration, and a module
 * repeating it does not "override" anything predictable: a CSS Module class and
 * a global class have identical specificity (0,1,0), so which one wins is
 * decided by the order the bundler happens to emit them in.
 *
 * `overflow-x` is deliberately absent. It is a different longhand from
 * `overflow-y` and the two combine rather than compete, so `overflow-x: hidden`
 * beside the shared `overflow-y: auto` is a legitimate thing to write.
 */
const FORBIDDEN_ON_MARKED = new Set(['max-height', 'max-block-size', 'overflow', 'overflow-y']);

/** Matches a class token exactly, so `dialog-panel-scroll` never counts as `dialog-panel`. */
function hasClassToken(haystack: string, token: string): boolean {
    return new RegExp(`(?<![\\w-])${token}(?![\\w-])`).test(haystack);
}

/**
 * Workspace packages that `apps/web` depends on, as absolute directories.
 *
 * Read from the app's own `package.json` rather than hard-coded: a `<dialog>`
 * reaching the page from a shared package is outside `apps/web/src` and so
 * outside every other assertion here, and the set of such packages is a thing
 * that changes without anyone thinking about dialogs.
 */
function webWorkspacePackages(): readonly string[] {
    const manifest = readFileSync(resolve(REPO_ROOT, 'apps/web/package.json'), 'utf8');
    const wanted = new Set(
        [...manifest.matchAll(/"(@repo\/[a-z0-9-]+)"\s*:\s*"workspace:/g)].map((m) => m[1])
    );
    const dirs: string[] = [];

    for (const pkgJson of globSync('packages/*/package.json', { cwd: REPO_ROOT, absolute: true })) {
        const name = /"name"\s*:\s*"([^"]+)"/.exec(readFileSync(pkgJson, 'utf8'))?.[1];
        if (name !== undefined && wanted.has(name)) dirs.push(dirname(pkgJson));
    }
    return dirs.sort();
}

/** Literal class tokens written directly in a `className` expression. */
function literalClassTokens(expression: string): readonly string[] {
    const tokens = new Set<string>();
    for (const [, quoted] of expression.matchAll(/['"`]([^'"`]*)['"`]/g)) {
        for (const token of (quoted ?? '').split(/\s+/)) {
            if (/^[A-Za-z][\w-]*$/.test(token)) tokens.add(token);
        }
    }
    return [...tokens];
}

/**
 * True when every class in the selector's subject compound is one of `tokens`,
 * and at least one is — i.e. the rule styles THIS element rather than one of
 * its descendants. `.feedback-root.dialog` matches; `.feedback-root.dialog
 * .content` does not, because its subject is the child.
 */
function compoundMatchesTokens(selector: string, tokens: readonly string[]): boolean {
    for (const part of selector.split(',')) {
        const cleaned = part.replace(/\([^()]*\)/g, '');
        const compounds = cleaned
            .trim()
            .split(/\s*[>+~]\s*|\s+/)
            .filter(Boolean);
        const subject = compounds.at(-1) ?? '';
        const classes = [...subject.matchAll(/\.([A-Za-z][\w-]*)/g)].map((m) => m[1] ?? '');
        if (classes.length > 0 && classes.every((cls) => tokens.includes(cls))) return true;
    }
    return false;
}

/** Escapes a string for literal use inside a RegExp. */
function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Reads a brace-balanced `{ ... }` expression starting at `open`, returning the
 * index just past its closing brace.
 */
function matchBrace(source: string, open: number): number {
    let depth = 0;
    let quote: string | null = null;

    for (let i = open; i < source.length; i += 1) {
        const char = source[i];
        if (quote !== null) {
            if (char === '\\') i += 1;
            else if (char === quote) quote = null;
        } else if (char === '"' || char === "'" || char === '`') {
            quote = char;
        } else if (char === '{') {
            depth += 1;
        } else if (char === '}') {
            depth -= 1;
            if (depth === 0) return i + 1;
        }
    }
    return source.length;
}

/**
 * Maps a component file's CSS-Module import bindings to their absolute paths,
 * e.g. `styles` → `.../WhatsNewModal.module.css`.
 *
 * Resolved per file rather than assumed co-located, because `WhatsNewPanel`
 * imports `./WhatsNewModal.module.css` and `RejectUsageDialog` imports its
 * sibling `./BenefitUsagesPanel.module.css` — the two files this guard would
 * have silently skipped if it had guessed the name from the component's.
 */
function resolveStyleImports(source: string, file: string): ReadonlyMap<string, string> {
    const bindings = new Map<string, string>();
    const importRe = /import\s+([A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+\.module\.css)['"]/g;
    let match = importRe.exec(source);

    while (match !== null) {
        const [, binding, specifier] = match;
        if (binding && specifier?.startsWith('.')) {
            bindings.set(binding, resolve(dirname(file), specifier));
        }
        match = importRe.exec(source);
    }
    return bindings;
}

/**
 * Every CSS-Module class applied to an element that carries `dialog-panel` or
 * `dialog-viewport` (`panel`) or `dialog-panel-scroll` (`scroll`).
 *
 * The two markers are resolved under DIFFERENT rules, and the asymmetry is the
 * point:
 *
 * - For `dialog-panel` / `dialog-viewport` every `styles.X` in the expression
 *   counts. The marker is unconditional in all of them, so each referenced
 *   class really is applied to the marked element — `MobileDrawer` adds
 *   `styles.drawerOpen` behind an `isOpen` ternary and both classes land on the
 *   same marked `<dialog>`.
 * - For `dialog-panel-scroll` the expression must be UNAMBIGUOUS: exactly one
 *   `styles.X`, and no conditional. `DialogBody` writes
 *   `bare ? styles.bodyBare : cn(styles.body, 'dialog-panel-scroll')`, where the
 *   marker itself sits inside one branch — so `.bodyBare` is not a marked
 *   element at all, and it legitimately declares `overflow: hidden`. Guessing
 *   which branch owns the marker would be worse than not checking, so that
 *   expression is skipped and COUNTED (`ambiguous`). A counted limit is a
 *   limit; an uncounted one is a fail-open.
 */
interface ModuleClassRef {
    readonly cssFile: string;
    readonly className: string;
}

/** A scroll region, plus where its element starts so its parent can be found. */
interface ScrollRef extends ModuleClassRef {
    readonly tagStart: number;
}

interface MarkedScan {
    readonly panel: readonly ModuleClassRef[];
    readonly scroll: readonly ScrollRef[];
    readonly ambiguous: number;
}

const EMPTY_SCAN: MarkedScan = { panel: [], scroll: [], ambiguous: 0 };

/** Every `binding.className` reference in one `className={...}` expression. */
function styleRefsIn(expression: string, bindings: ReadonlyMap<string, string>): ModuleClassRef[] {
    const refs: ModuleClassRef[] = [];
    for (const [binding, cssFile] of bindings) {
        const refRe = new RegExp(`\\b${escapeRegExp(binding)}\\.([A-Za-z_$][\\w$]*)`, 'g');
        let ref = refRe.exec(expression);
        while (ref !== null) {
            const className = ref[1];
            if (className !== undefined) refs.push({ cssFile, className });
            ref = refRe.exec(expression);
        }
    }
    return refs;
}

/**
 * True when the expression branches, so which class the marker lands on cannot
 * be decided by reading it. `?.` is optional chaining, not a ternary.
 */
function isConditionalExpression(expression: string): boolean {
    return /\?[^.]|&&|\|\|/.test(expression);
}

/** The `className={...}` expression of one opening tag, braces included. */
function classNameExpression(tagText: string): string | undefined {
    const at = tagText.indexOf('className=');
    if (at < 0) return undefined;
    const open = tagText.indexOf('{', at);
    if (open < 0) return undefined;
    return tagText.slice(open, matchBrace(tagText, open));
}

function markedModuleClasses(source: string, file: string): MarkedScan {
    const anyMarker =
        hasClassToken(source, 'dialog-panel') ||
        hasClassToken(source, 'dialog-viewport') ||
        hasClassToken(source, 'dialog-panel-scroll');
    if (!anyMarker) return EMPTY_SCAN;

    const bindings = resolveStyleImports(source, file);
    if (bindings.size === 0) return EMPTY_SCAN;

    const panel: ModuleClassRef[] = [];
    const scroll: ScrollRef[] = [];
    let ambiguous = 0;

    for (const tag of scanJsxTags(source)) {
        if (tag.kind === 'close') continue;
        // The className expression, not the whole tag: a conditional in some
        // unrelated attribute (`onClick={() => a && b}`) must not make the
        // class assignment look ambiguous.
        const expression = classNameExpression(tag.text) ?? tag.text;

        if (
            hasClassToken(expression, 'dialog-panel') ||
            hasClassToken(expression, 'dialog-viewport')
        ) {
            panel.push(...styleRefsIn(expression, bindings));
        } else if (hasClassToken(expression, 'dialog-panel-scroll')) {
            const refs = styleRefsIn(expression, bindings);
            const only = refs[0];
            if (refs.length === 1 && only !== undefined && !isConditionalExpression(expression)) {
                scroll.push({ ...only, tagStart: tag.start });
            } else {
                ambiguous += 1;
            }
        }
    }

    return { panel, scroll, ambiguous };
}

/** True when `className` appears in the SUBJECT compound of any of `selector`'s parts. */
function selectorTargetsClass(selector: string, className: string): boolean {
    const classRe = new RegExp(`\\.${escapeRegExp(className)}(?![\\w-])`);

    for (const part of selector.split(',')) {
        // Drop `:has(...)` / `:not(...)` arguments: `.overlay:has(.panel)` styles
        // the overlay, not the panel, and must not be attributed to `.panel`.
        const cleaned = part.replace(/\([^()]*\)/g, '');
        const compounds = cleaned
            .trim()
            .split(/\s*[>+~]\s*|\s+/)
            .filter(Boolean);
        const subject = compounds.at(-1) ?? '';
        if (classRe.test(subject)) return true;
    }
    return false;
}

/**
 * Every declaration of a forbidden property in a rule whose subject compound
 * includes `className`, with its 1-based line number.
 *
 * Walks the whole stylesheet, including rules nested inside `@media` — the
 * MobileDrawer declares its entire panel inside `@media (max-width: 767px)`,
 * so a scanner that only looked at top-level rules would report it clean.
 */
interface CssDeclaration {
    readonly property: string;
    readonly value: string;
    readonly line: number;
    readonly text: string;
}

/**
 * Every declaration in every rule whose subject compound satisfies `targets`,
 * with 1-based line numbers.
 *
 * `targets` receives the raw selector prelude, so callers decide what "this
 * rule styles my element" means: one CSS-Module class inside `apps/web`, or a
 * whole compound of literal classes for a package's global stylesheet.
 */
function declarationsIn(
    css: string,
    targets: (selector: string) => boolean
): readonly CssDeclaration[] {
    const found: CssDeclaration[] = [];
    const source = css.replace(/\/\*[\s\S]*?\*\//g, blank);
    const openers: number[] = [];

    for (let i = 0; i < source.length; i += 1) {
        if (source[i] === '{') openers.push(i);
    }

    for (const open of openers) {
        const preludeStart = Math.max(
            source.lastIndexOf('{', open - 1),
            source.lastIndexOf('}', open - 1),
            source.lastIndexOf(';', open - 1)
        );
        const prelude = source.slice(preludeStart + 1, open).trim();
        if (prelude.length === 0 || prelude.startsWith('@')) continue;
        if (!targets(prelude)) continue;

        const body = source.slice(open + 1, matchBrace(source, open) - 1);
        let cursor = open + 1;
        for (const rawDecl of body.split(';')) {
            const decl = rawDecl.trim();
            const parsed = /^([-a-zA-Z]+)\s*:\s*([\s\S]*)$/.exec(decl);
            if (parsed?.[1] !== undefined) {
                const at = cursor + rawDecl.indexOf(decl);
                found.push({
                    property: parsed[1],
                    value: (parsed[2] ?? '').trim(),
                    line: source.slice(0, at).split('\n').length,
                    text: decl.replace(/\s+/g, ' ')
                });
            }
            cursor += rawDecl.length + 1;
        }
    }

    return found;
}

/**
 * Declarations of a forbidden property on rules whose subject compound includes
 * `className`.
 *
 * Walks the whole stylesheet, including rules nested inside `@media` — the
 * MobileDrawer declares its entire panel inside `@media (max-width: 767px)`,
 * so a scanner that only looked at top-level rules would report it clean.
 */
function forbiddenDeclarations(css: string, className: string): readonly CssDeclaration[] {
    return declarationsIn(css, (selector) => selectorTargetsClass(selector, className)).filter(
        (decl) => FORBIDDEN_ON_MARKED.has(decl.property)
    );
}

/** True when the class is given a flex or grid formatting context by its module. */
function establishesFlexContext(css: string, className: string): boolean {
    return declarationsIn(css, (selector) => selectorTargetsClass(selector, className)).some(
        (decl) => decl.property === 'display' && /^(inline-)?(flex|grid)$/.test(decl.value)
    );
}

/** Blanks a run of source to spaces, keeping newlines so line numbers survive. */
function blank(text: string): string {
    return text.replace(/[^\n]/g, ' ');
}

/**
 * Blanks out `/* ... *\/` and `// ...` comments.
 *
 * Not cosmetic: this repo documents its dialogs heavily, and the word
 * `<dialog>` appears in twenty-two JSDoc blocks and `biome-ignore` lines — more
 * often than the element itself. Without this, the guard reported every one of
 * them as an uncapped dialog and its real findings were unreadable.
 *
 * A `//` preceded by `:` is left alone so a `https://` inside an attribute is
 * not mistaken for a comment and its line silently discarded.
 */
function stripComments(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, blank)
        .replace(/(^|[^:\\])(\/\/[^\n]*)/g, (_match, lead: string, comment: string) => {
            return lead + blank(comment);
        });
}

/**
 * Returns the text of every `<dialog ...>` opening tag in `source`, with its
 * 1-based line number.
 *
 * Walks the tag character by character rather than regexing to the first `>`:
 * a JSX handler such as `onClick={(event) => ...}` puts a `>` inside the
 * attribute list, and a naive match would cut the tag in half and miss a class
 * declared after it.
 */
function extractDialogOpenTags(source: string): readonly { tag: string; line: number }[] {
    return scanJsxTags(source)
        .filter((tag) => tag.name === 'dialog' && tag.kind !== 'close')
        .map((tag) => ({
            tag: tag.text,
            line: source.slice(0, tag.start).split('\n').length
        }));
}

interface JsxTag {
    readonly name: string;
    readonly kind: 'open' | 'close' | 'self';
    readonly start: number;
    readonly text: string;
}

/**
 * Every JSX tag in `source`, in order.
 *
 * Ends each tag with the same brace/quote-aware walk `<dialog>` always needed:
 * `onClick={(event) => …}` puts a `>` inside the attribute list, and stopping
 * at the first one would cut the tag in half. Fragments (`<>` / `</>`) are
 * emitted with an empty name so the nesting stack stays balanced around them.
 */
function scanJsxTags(source: string): readonly JsxTag[] {
    const tags: JsxTag[] = [];

    for (let i = 0; i < source.length; i += 1) {
        if (source[i] !== '<') continue;
        const isClose = source[i + 1] === '/';
        const nameStart = i + (isClose ? 2 : 1);
        const nameMatch = /^[A-Za-z][\w.]*/.exec(source.slice(nameStart, nameStart + 64));
        const name = nameMatch?.[0] ?? '';
        // A `<` that begins neither a named tag nor a fragment is not JSX
        // (a comparison, a generic, a stray character in a string).
        if (name === '' && source[nameStart] !== '>') continue;

        let index = nameStart + name.length;
        let depth = 0;
        let quote: string | null = null;

        while (index < source.length) {
            const char = source[index];
            if (quote !== null) {
                if (char === '\\') index += 1;
                else if (char === quote) quote = null;
            } else if (char === '"' || char === "'" || char === '`') {
                quote = char;
            } else if (char === '{') {
                depth += 1;
            } else if (char === '}') {
                depth -= 1;
            } else if (char === '>' && depth === 0) {
                break;
            }
            index += 1;
        }

        const text = source.slice(i, index + 1);
        const kind = isClose ? 'close' : /\/\s*>$/.test(text) ? 'self' : 'open';
        tags.push({ name, kind, start: i, text });
        i = index;
    }

    return tags;
}

/**
 * The opening tag that directly encloses the tag starting at `start`, or
 * `undefined` when it has none in this file.
 *
 * Replays the file's tag stream and returns whatever is on top of the nesting
 * stack when it reaches the target. Exact, not inferred — no indentation
 * heuristic, which would go quietly wrong the first time Biome reformats a
 * file. Components defined side by side in one file each balance their own
 * `return (...)`, so `ListView`'s body resolves to `ListView`'s root and not to
 * the exported component's.
 */
function jsxParentTag(source: string, start: number): JsxTag | undefined {
    const stack: JsxTag[] = [];

    for (const tag of scanJsxTags(source)) {
        if (tag.start === start) return stack.at(-1);
        if (tag.kind === 'open') stack.push(tag);
        else if (tag.kind === 'close') stack.pop();
    }
    return undefined;
}

function main(): void {
    const errors: string[] = [];
    const cssCache = new Map<string, string>();
    const readCss = (cssFile: string): string => {
        let css = cssCache.get(cssFile);
        if (css === undefined) {
            try {
                css = readFileSync(cssFile, 'utf8');
            } catch {
                css = '';
            }
            cssCache.set(cssFile, css);
        }
        return css;
    };

    // ── 3. The mechanism itself still exists ────────────────────────────────
    const css = readFileSync(COMPONENTS_CSS, 'utf8');
    for (const cls of MECHANISM_CLASSES) {
        if (!new RegExp(`(?<![\\w-])\\.${cls}(?![\\w-])\\s*\\{`).test(css)) {
            errors.push(
                `apps/web/src/styles/components.css no longer defines '.${cls}'.\n` +
                    '  The shared dialog mechanism is what this guard enforces. If it was\n' +
                    '  renamed, rename it here too; if it was deleted, every dialog in the\n' +
                    '  app just lost its height cap.'
            );
        }
    }

    // ── 4. The React primitive still composes it ────────────────────────────
    const primitive = readFileSync(DIALOG_PRIMITIVE, 'utf8');
    for (const cls of ['dialog-panel', 'dialog-panel-scroll'] as const) {
        if (!hasClassToken(primitive, cls)) {
            errors.push(
                `apps/web/src/components/shared/ui/Dialog.client.tsx no longer composes '${cls}'.\n` +
                    '  It renders a portalled <div role="dialog">, not a <dialog> element, so\n' +
                    '  the element scan below cannot see it — this assertion is the only thing\n' +
                    "  standing between the app's most used modal and an uncapped height."
            );
        }
    }

    // ── 1 + 2 + 6. Element markers, viewport budget, competing declarations ──
    const files = globSync(['**/*.tsx', '**/*.astro'], { cwd: WEB_SRC, absolute: true }).sort();
    const viewportSeen = new Map<string, number>();
    /** Every (css file, class) pair applied to a marked element — deduplicated. */
    const panelPairs = new Map<string, ModuleClassRef>();
    const scrollPairs = new Map<string, ModuleClassRef>();
    let ambiguousExpressions = 0;
    let dialogCount = 0;
    let scrollParentsChecked = 0;
    let unresolvedParents = 0;

    for (const file of files) {
        const rel = relative(REPO_ROOT, file);
        const raw = readFileSync(file, 'utf8');
        const stripped = stripComments(raw);

        const scan = markedModuleClasses(stripped, file);
        for (const pair of scan.panel) panelPairs.set(`${pair.cssFile}::${pair.className}`, pair);
        for (const pair of scan.scroll) scrollPairs.set(`${pair.cssFile}::${pair.className}`, pair);
        ambiguousExpressions += scan.ambiguous;

        // ── 8. A scroll region only works inside a flex/grid parent ─────────
        for (const region of scan.scroll) {
            const bindings = resolveStyleImports(stripped, file);
            const parent = jsxParentTag(stripped, region.tagStart);
            const parentExpr =
                parent === undefined
                    ? undefined
                    : (classNameExpression(parent.text) ?? parent.text);
            const parentRefs = parentExpr === undefined ? [] : styleRefsIn(parentExpr, bindings);
            const parentClass = parentRefs.length === 1 ? parentRefs[0] : undefined;

            if (parentClass === undefined) {
                unresolvedParents += 1;
                continue;
            }

            scrollParentsChecked += 1;
            const parentCss = readCss(parentClass.cssFile);
            if (!establishesFlexContext(parentCss, parentClass.className)) {
                const line = stripped.slice(0, region.tagStart).split('\n').length;
                errors.push(
                    `${rel}:${line} — this 'dialog-panel-scroll' region sits inside ` +
                        `'.${parentClass.className}', which is not a flex or grid container.\n` +
                        `  ${relative(REPO_ROOT, parentClass.cssFile)} does not give it ` +
                        "'display: flex' (or grid), and `flex: 1 1 auto; min-height: 0` on a\n" +
                        '  child of a BLOCK parent does nothing at all: the region does not\n' +
                        '  scroll, the whole panel scrolls instead, and the header this\n' +
                        '  arrangement exists to keep in place scrolls away with it.\n' +
                        '  Either declare `display: flex; flex-direction: column` on the parent,\n' +
                        "  or drop 'dialog-panel-scroll' and let the panel scroll as one flow."
                );
            }
        }

        if (!raw.includes('<dialog')) continue;
        const source = stripped;

        for (const { tag, line } of extractDialogOpenTags(source)) {
            dialogCount += 1;
            const isPanel = hasClassToken(tag, 'dialog-panel');
            const isViewport = hasClassToken(tag, 'dialog-viewport');

            if (isViewport) {
                viewportSeen.set(rel, (viewportSeen.get(rel) ?? 0) + 1);
            }

            if (!isPanel && !isViewport) {
                errors.push(
                    `${rel}:${line} — <dialog> carries neither 'dialog-panel' nor 'dialog-viewport'.\n` +
                        '  Without one of them this dialog has no height cap: it renders fine\n' +
                        '  until the data makes it taller than the window, and then its buttons\n' +
                        '  sit off-screen with no scrollbar to reach them.\n' +
                        "  Add 'dialog-panel' to this tag (see apps/web/src/styles/components.css)."
                );
            }
        }
    }

    for (const [rel, count] of viewportSeen) {
        const budget = VIEWPORT_BUDGET.get(rel);
        if (budget === undefined) {
            errors.push(
                `${rel} — uses 'dialog-viewport' but is not in VIEWPORT_BUDGET.\n` +
                    "  'dialog-viewport' says the <dialog> is a full-viewport overlay or\n" +
                    '  drawer whose height cap lives on a child, which is the one shape this\n' +
                    '  guard cannot verify. Add the file (and where the cap actually lives) to\n' +
                    `  VIEWPORT_BUDGET in ${relative(REPO_ROOT, fileURLToPath(import.meta.url))}, ` +
                    'or use\n  ' +
                    "'dialog-panel' instead."
            );
        } else if (budget !== count) {
            errors.push(
                `${rel} — expected ${budget} 'dialog-viewport' dialog(s), found ${count}.\n` +
                    '  Update VIEWPORT_BUDGET deliberately, having checked that the new one\n' +
                    '  really does delegate its cap to a capped child.'
            );
        }
    }

    for (const rel of VIEWPORT_BUDGET.keys()) {
        if (!viewportSeen.has(rel)) {
            errors.push(
                `${rel} — listed in VIEWPORT_BUDGET but no 'dialog-viewport' dialog was found.\n` +
                    '  Either the file moved (fix the path) or the exemption is stale (drop it).'
            );
        }
    }

    // ── 6. No module re-declares what the shared class declares ─────────────
    for (const { cssFile, className } of panelPairs.values()) {
        for (const { property, line, text } of forbiddenDeclarations(readCss(cssFile), className)) {
            errors.push(
                `${relative(REPO_ROOT, cssFile)}:${line} — '.${className}' is applied to an element ` +
                    `carrying 'dialog-panel'/'dialog-viewport'\n` +
                    `  and declares '${property}' (\`${text}\`), which the shared class already ` +
                    'declares.\n' +
                    '  A CSS Module class and a global class have the SAME specificity, so this\n' +
                    "  does not override the shared class — it races it, and the bundler's emit\n" +
                    '  order decides. A cap that loses that race is not a cap.\n' +
                    (property === 'max-height' || property === 'max-block-size'
                        ? '  To give this one panel a different cap, set the custom property\n' +
                          '  `--dialog-max-height` on it instead.'
                        : '  If this panel keeps a fixed header and delegates scrolling to a child,\n' +
                          "  mark that child with 'dialog-panel-scroll' rather than re-declaring\n" +
                          '  overflow here.')
            );
        }
    }

    // ── 6b. Same rule for the scroll region — the mechanism's other half ────
    for (const { cssFile, className } of scrollPairs.values()) {
        for (const { property, line, text } of forbiddenDeclarations(readCss(cssFile), className)) {
            errors.push(
                `${relative(REPO_ROOT, cssFile)}:${line} — '.${className}' is applied to an element ` +
                    `carrying 'dialog-panel-scroll'\n` +
                    `  and declares '${property}' (\`${text}\`), which the shared class already ` +
                    'declares.\n' +
                    '  Same equal-specificity race as on the panel, and the same outcome for the\n' +
                    '  user: the panel obeys its cap while the content inside it is cut off with\n' +
                    '  no scrollbar, so the buttons at the bottom stay unreachable.\n' +
                    '  Layout that is genuinely local (padding, gap, direction) belongs here;\n' +
                    '  the scrolling does not.'
            );
        }
    }

    // ── 7. Dialogs that reach the page from a workspace package ────────────
    //
    // A shared package cannot compose `.dialog-panel`: the class lives in
    // `apps/web`'s global stylesheet and would simply not exist in another
    // host. So the assertion here is weaker on purpose, and states only what
    // is true of ANY usable dialog anywhere — it is bounded to the viewport,
    // and something inside it scrolls. What it will not accept is a dialog
    // that is bounded by nothing at all, which is the state six of this app's
    // own dialogs were in.
    let packageDialogs = 0;

    for (const pkgDir of webWorkspacePackages()) {
        const pkgRel = relative(REPO_ROOT, pkgDir);
        const sources = globSync('src/**/*.{tsx,astro}', { cwd: pkgDir, absolute: true }).sort();
        const styles = globSync('src/**/*.css', { cwd: pkgDir, absolute: true }).sort();
        const allCss = styles.map(readCss).join('\n');
        const packageScrolls = /overflow(-y)?\s*:\s*(auto|scroll)/.test(allCss);

        for (const file of sources) {
            const source = stripComments(readFileSync(file, 'utf8'));
            for (const tag of scanJsxTags(source)) {
                if (tag.name !== 'dialog' || tag.kind === 'close') continue;
                packageDialogs += 1;

                const rel = relative(REPO_ROOT, file);
                const line = source.slice(0, tag.start).split('\n').length;
                const tokens = literalClassTokens(classNameExpression(tag.text) ?? tag.text);

                if (tokens.length === 0) {
                    errors.push(
                        `${rel}:${line} — <dialog> in workspace package '${pkgRel}' carries no ` +
                            'literal class,\n' +
                            '  so nothing here can tell whether its height is bounded. Give it a\n' +
                            '  class this guard can follow into the package stylesheet.'
                    );
                    continue;
                }

                const rules = declarationsIn(allCss, (sel) => compoundMatchesTokens(sel, tokens));
                if (rules.length === 0) {
                    errors.push(
                        `${rel}:${line} — <dialog> in workspace package '${pkgRel}' has classes ` +
                            `[${tokens.join(', ')}]\n` +
                            '  but no rule in the package stylesheet targets them, so its height\n' +
                            '  is whatever the user agent decides. Unverifiable is not the same\n' +
                            '  as fine.'
                    );
                    continue;
                }

                const bounded = rules.some(
                    (decl) =>
                        (decl.property === 'max-height' && decl.value !== 'none') ||
                        (decl.property === 'max-block-size' && decl.value !== 'none') ||
                        (decl.property === 'height' && /\d\s*(dvh|svh|lvh|vh|%)/.test(decl.value))
                );

                if (!bounded) {
                    errors.push(
                        `${rel}:${line} — <dialog> in workspace package '${pkgRel}' is not bounded ` +
                            'to the viewport.\n' +
                            `  Its rules (classes [${tokens.join(', ')}]) declare no 'max-height' ` +
                            "other than 'none',\n" +
                            "  and no viewport-relative 'height'. It grows with its content, and " +
                            'past the\n' +
                            '  bottom of the window there is nothing to scroll.\n' +
                            "  A package cannot use apps/web's '.dialog-panel', so it has to bound " +
                            'itself.'
                    );
                }

                if (!packageScrolls) {
                    errors.push(
                        `${rel}:${line} — <dialog> in workspace package '${pkgRel}' is bounded but ` +
                            'nothing inside it scrolls.\n' +
                            "  No rule in the package stylesheet declares 'overflow-y: auto|scroll'," +
                            ' so content\n' +
                            '  taller than the cap is clipped rather than reachable — the worse ' +
                            'half of the\n' +
                            '  bug this guard exists for.'
                    );
                }
            }
        }
    }

    if (packageDialogs === 0) {
        errors.push(
            'No <dialog> found in any workspace package apps/web depends on.\n' +
                '  @repo/feedback ships one onto every page, so zero means the package scan\n' +
                '  is broken — a moved directory, a renamed extension — not that the packages\n' +
                '  are clean.'
        );
    }

    // ── 5. The scan actually scanned something ──────────────────────────────
    if (dialogCount === 0) {
        errors.push(
            `No <dialog> element found anywhere under ${relative(REPO_ROOT, WEB_SRC)}.\n` +
                '  The app has had them since well before this guard existed, so zero means\n' +
                '  the scan is broken, not that the tree is clean.'
        );
    }

    if (panelPairs.size === 0) {
        errors.push(
            "No CSS-Module class was found on any element carrying 'dialog-panel' or\n" +
                "  'dialog-viewport'. Assertion 6 has nothing to check, so it would pass on any\n" +
                '  stylesheet whatsoever. Zero means the className/import scan is broken, not\n' +
                '  that the modules are clean.'
        );
    }

    if (scrollPairs.size === 0) {
        errors.push(
            "No CSS-Module class was found on any element carrying 'dialog-panel-scroll'.\n" +
                '  Assertion 6b has nothing to check. There are unambiguous call sites in the\n' +
                '  app, so zero means the resolver stopped matching them — not that the scroll\n' +
                '  regions are clean.'
        );
    }

    if (scrollParentsChecked === 0) {
        errors.push(
            'No scroll region had a resolvable JSX parent.\n' +
                '  Assertion 8 has nothing to check. Every scroll region in the app is nested\n' +
                '  inside an element with a CSS-Module class, so zero means the parent\n' +
                '  resolution broke — not that the parents are flex.'
        );
    }

    if (errors.length > 0) {
        console.error('\n[check-dialog-panel] FAILED\n');
        for (const error of errors) console.error(`  ✗ ${error}\n`);
        console.error(
            `[check-dialog-panel] ${errors.length} problem(s) across ${dialogCount} <dialog> element(s).\n`
        );
        process.exit(1);
    }

    console.log(
        `[check-dialog-panel] OK — ${dialogCount} <dialog> element(s) checked, ` +
            `${[...viewportSeen.values()].reduce((a, b) => a + b, 0)} viewport exemption(s) within budget, ` +
            `${panelPairs.size} panel + ${scrollPairs.size} scroll CSS-Module class(es) free of ` +
            `competing declarations, ${scrollParentsChecked} scroll parent(s) confirmed flex, ` +
            `${packageDialogs} package dialog(s) bounded, ${ambiguousExpressions} ambiguous ` +
            `className expression${ambiguousExpressions === 1 ? '' : 's'} and ` +
            `${unresolvedParents} unresolvable parent(s) NOT verified.`
    );
}

main();
