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

interface MarkedScan {
    readonly panel: readonly ModuleClassRef[];
    readonly scroll: readonly ModuleClassRef[];
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

function markedModuleClasses(source: string, file: string): MarkedScan {
    const anyMarker =
        hasClassToken(source, 'dialog-panel') ||
        hasClassToken(source, 'dialog-viewport') ||
        hasClassToken(source, 'dialog-panel-scroll');
    if (!anyMarker) return EMPTY_SCAN;

    const bindings = resolveStyleImports(source, file);
    if (bindings.size === 0) return EMPTY_SCAN;

    const panel: ModuleClassRef[] = [];
    const scroll: ModuleClassRef[] = [];
    let ambiguous = 0;
    const attrRe = /className=\{/g;
    let match = attrRe.exec(source);

    while (match !== null) {
        const open = source.indexOf('{', match.index);
        const expression = source.slice(open, matchBrace(source, open));
        attrRe.lastIndex = open + expression.length;

        if (
            hasClassToken(expression, 'dialog-panel') ||
            hasClassToken(expression, 'dialog-viewport')
        ) {
            panel.push(...styleRefsIn(expression, bindings));
        } else if (hasClassToken(expression, 'dialog-panel-scroll')) {
            const refs = styleRefsIn(expression, bindings);
            if (refs.length === 1 && !isConditionalExpression(expression)) {
                scroll.push(...refs);
            } else {
                ambiguous += 1;
            }
        }
        match = attrRe.exec(source);
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
function forbiddenDeclarations(
    css: string,
    className: string
): readonly { readonly property: string; readonly line: number; readonly text: string }[] {
    const found: { property: string; line: number; text: string }[] = [];
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
        if (!selectorTargetsClass(prelude, className)) continue;

        const body = source.slice(open + 1, matchBrace(source, open) - 1);
        let cursor = open + 1;
        for (const rawDecl of body.split(';')) {
            const decl = rawDecl.trim();
            const property = /^([-a-zA-Z]+)\s*:/.exec(decl)?.[1];
            if (property !== undefined && FORBIDDEN_ON_MARKED.has(property)) {
                const at = cursor + rawDecl.indexOf(decl);
                found.push({
                    property,
                    line: source.slice(0, at).split('\n').length,
                    text: decl.replace(/\s+/g, ' ')
                });
            }
            cursor += rawDecl.length + 1;
        }
    }

    return found;
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
    const found: { tag: string; line: number }[] = [];
    const opener = /<dialog(?=[\s>/])/g;
    let match = opener.exec(source);

    while (match !== null) {
        const start = match.index;
        let index = start + '<dialog'.length;
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

        found.push({
            tag: source.slice(start, index + 1),
            line: source.slice(0, start).split('\n').length
        });
        match = opener.exec(source);
    }

    return found;
}

function main(): void {
    const errors: string[] = [];

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

    for (const file of files) {
        const rel = relative(REPO_ROOT, file);
        const raw = readFileSync(file, 'utf8');
        const stripped = stripComments(raw);

        const scan = markedModuleClasses(stripped, file);
        for (const pair of scan.panel) panelPairs.set(`${pair.cssFile}::${pair.className}`, pair);
        for (const pair of scan.scroll) scrollPairs.set(`${pair.cssFile}::${pair.className}`, pair);
        ambiguousExpressions += scan.ambiguous;

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
            `competing declarations, ${ambiguousExpressions} ambiguous className ` +
            `expression${ambiguousExpressions === 1 ? '' : 's'} NOT verified.`
    );
}

main();
