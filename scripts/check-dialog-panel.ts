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
import { relative, resolve } from 'node:path';
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

/** Matches a class token exactly, so `dialog-panel-scroll` never counts as `dialog-panel`. */
function hasClassToken(haystack: string, token: string): boolean {
    return new RegExp(`(?<![\\w-])${token}(?![\\w-])`).test(haystack);
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

    // ── 1 + 2. Every <dialog> element carries a marker ──────────────────────
    const files = globSync(['**/*.tsx', '**/*.astro'], { cwd: WEB_SRC, absolute: true }).sort();
    const viewportSeen = new Map<string, number>();
    let dialogCount = 0;

    for (const file of files) {
        const rel = relative(REPO_ROOT, file);
        const raw = readFileSync(file, 'utf8');
        if (!raw.includes('<dialog')) continue;
        const source = stripComments(raw);

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

    // ── 5. The scan actually scanned something ──────────────────────────────
    if (dialogCount === 0) {
        errors.push(
            `No <dialog> element found anywhere under ${relative(REPO_ROOT, WEB_SRC)}.\n` +
                '  The app has had them since well before this guard existed, so zero means\n' +
                '  the scan is broken, not that the tree is clean.'
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
            `${[...viewportSeen.values()].reduce((a, b) => a + b, 0)} viewport exemption(s) within budget.`
    );
}

main();
