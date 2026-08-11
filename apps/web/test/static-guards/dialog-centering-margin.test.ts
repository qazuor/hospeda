/**
 * @file dialog-centering-margin.test.ts
 * @description Static guard (HOS-376) — every CSS Module that styles a native
 * `<dialog>` must restore `margin: auto`.
 *
 * WHY A GUARD. A native `<dialog>` centres itself because the user-agent
 * stylesheet pairs `inset: 0` with `margin: auto`. This app's global reset zeroes
 * margins, so a `.dialog` rule that does not restore `auto` renders the modal
 * pinned to the top-left corner of the viewport — `inset:0` + `margin:0` resolves
 * to (0,0), not to centre.
 *
 * The recurrence is the point. THREE modules already carried the fix, each with a
 * comment naming this exact failure ("a global reset zeroes margins, which would
 * otherwise pin the dialog to the top-left corner") — and the two dialogs added by
 * HOS-376 still shipped without it, reaching staging with all three of their
 * modals in the corner. A comment only protects the developer who reads it, so
 * the invariant is restated here as something CI can answer.
 *
 * WHAT THE PREDICATE ACTUALLY PROVES, stated narrowly on purpose: that a module
 * containing a `.dialog` rule ALSO contains a `margin`/`margin-*` declaration
 * resolving to `auto`, outside comments. That is presence, not centring.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not resolve the cascade, and must not
 * claim to. A later `margin: 0` — in a duplicate selector, a descendant rule, a
 * `@media` block, or another file — still wins at runtime and this guard stays
 * green. Locating "the" rule by selector reads the FIRST match while the cascade
 * is decided by the LAST, which is a CSS engine's job and not a regex's (the same
 * conclusion `whatsapp-channel-tokens.test.ts` reached after three defeated
 * revisions). Presence is the part worth policing because absence is the failure
 * that actually happened, twice.
 *
 * Comments are stripped BEFORE the search, so a commented-out `margin: auto` — or
 * the prose comment above the real declaration — cannot satisfy the requirement.
 * Stripping is safe here precisely because this asserts a PRESENCE: over-stripping
 * can only remove a match and fail the guard, never manufacture one.
 *
 * ALSO NOT SEEN: `<dialog>` styled from an Astro scoped `<style>` block or from
 * `global.css` rather than a CSS Module (no dialog in this app is today), a
 * dialog centred by other means (`transform`, grid placement) which would fail
 * this guard despite being correct — accepted, since every dialog here uses the
 * native centring — and dialogs outside `apps/web/src`.
 *
 * @module test/static-guards/dialog-centering-margin
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_SRC = path.resolve(__dirname, '../../src');

/**
 * Lower bound on modules discovered. A mis-resolved `WEB_SRC` (or a rename that
 * moves every dialog out of the scan) would otherwise report an empty set and
 * pass while checking nothing — the failure mode that reads as "no findings".
 */
const MIN_DIALOG_MODULES = 5;

/** Matches a `.dialog` class selector at the start of a rule. */
const DIALOG_SELECTOR = /^\s*\.dialog\b[^{]*\{/m;

/**
 * Matches a `margin` / `margin-top` / `margin-block` … declaration whose value
 * contains `auto`. Shorthand forms (`margin: 0 auto`, `margin: auto`) and
 * longhands both qualify.
 */
const MARGIN_AUTO = /\bmargin(?:-[a-z-]+)?\s*:[^;}]*\bauto\b/;

/** Strips `/* … *\/` comments so commented-out CSS cannot satisfy a check. */
function stripComments(css: string): string {
    return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Every `*.module.css` under `apps/web/src`, as paths relative to it. */
function collectCssModules(dir: string, acc: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            collectCssModules(full, acc);
        } else if (entry.name.endsWith('.module.css')) {
            acc.push(path.relative(WEB_SRC, full));
        }
    }
    return acc;
}

describe('dialog centering margin (HOS-376 static guard)', () => {
    const modulesWithDialog = collectCssModules(WEB_SRC).filter((rel) =>
        DIALOG_SELECTOR.test(fs.readFileSync(path.join(WEB_SRC, rel), 'utf8'))
    );

    it(`discovers at least ${MIN_DIALOG_MODULES} modules that style a dialog`, () => {
        // Guards the guard: an empty or near-empty scan must fail loudly rather
        // than certify nothing.
        expect(modulesWithDialog.length).toBeGreaterThanOrEqual(MIN_DIALOG_MODULES);
    });

    it('every module styling a .dialog declares a margin resolving to auto', () => {
        const missing = modulesWithDialog.filter(
            (rel) =>
                !MARGIN_AUTO.test(stripComments(fs.readFileSync(path.join(WEB_SRC, rel), 'utf8')))
        );

        expect(
            missing,
            `These CSS Modules style a .dialog but never declare a margin resolving to auto. ` +
                `A native <dialog> centres via the user-agent's "inset: 0 + margin: auto" pairing, ` +
                `and this app's global reset zeroes the margin — so without it the modal renders ` +
                `pinned to the top-left corner. Add "margin: auto" to the .dialog rule. ` +
                `Note this check proves the declaration is PRESENT, not that the dialog ends up ` +
                `centred: a later "margin: 0" can still override it.\n  ` +
                missing.join('\n  ')
        ).toEqual([]);
    });
});
