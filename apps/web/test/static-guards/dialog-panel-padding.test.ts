/**
 * @file dialog-panel-padding.test.ts
 * @description Static guard (HOS-1235) — the shared `Dialog` panel must keep
 * its fallback padding, and every structural slot must stay listed in the rule
 * that opts out of it.
 *
 * WHY A GUARD. `Dialog.module.css` used to leave `.panel` with no padding at
 * all, on the assumption that content brings its own. Thirteen of the fifteen
 * consumers do, because they compose `DialogHeader`/`DialogBody`/`DialogFooter`,
 * which each carry padding. Two did not — both commerce plan pickers pass bare
 * children — and shipped a heading at 0px from the panel corner, on the screen
 * a customer sees while deciding to pay more.
 *
 * The fix has two halves that only work together, which is exactly why they
 * need policing as a pair:
 *
 *   1. `.panel` declares a non-zero `padding`, so bare children can never
 *      render flush against the edge.
 *   2. A `:has()` rule zeroes that padding when a structural slot is present,
 *      because those slots pad themselves AND their `border-top`/`border-bottom`
 *      separators are meant to span the panel edge to edge. Padding the panel
 *      too would inset every separator by 20px on both sides and double the
 *      gutters, on all thirteen.
 *
 * Delete half 1 and the original bug returns. Add a fifth slot to the component
 * without adding it to half 2 and that slot's dialog gets double padding.
 * Neither shows up in a typecheck, a lint, or any rendering test in this repo.
 *
 * WHAT THE PREDICATES ACTUALLY PROVE, stated narrowly on purpose:
 *   - that `.panel`'s rule contains a `padding` declaration whose value is not
 *     `0`;
 *   - that a `:has()` rule setting `padding: 0` exists;
 *   - that the set of `styles.*` bindings referenced by the component file is
 *     EXACTLY the frozen set below.
 *
 * That third one is the load-bearing check, and it is a frozen inventory rather
 * than an inference. There is no reliable way to tell a "slot" (`.body`) from a
 * "child" (`.title`, `.closeButton`) by parsing JSX — the honest move is to
 * fail on ANY change to the class inventory and make a human classify it. So
 * adding a class to the component fails this guard until someone either lists
 * it as a slot in the CSS or records it here as a non-slot.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not resolve the cascade. A later
 * `padding` on `.panel` — in a duplicate selector, a `@media` block, or another
 * file — still wins at runtime and this guard stays green. It also does not
 * verify that the rendered dialog has any particular gap: that is a browser's
 * job, and the measurement in HOS-1235 was taken in one. Presence and inventory
 * are policed because absence and drift are the failures that actually
 * happened.
 *
 * The `transparent` variant is expected to re-zero the padding (the lightbox
 * wants every pixel) and is asserted to stay BELOW the `:has()` rule, since the
 * two match on specificity and only source order separates them.
 *
 * @module test/static-guards/dialog-panel-padding
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const UI_DIR = path.resolve(__dirname, '../../src/components/shared/ui');
const CSS_PATH = path.join(UI_DIR, 'Dialog.module.css');
const TSX_PATH = path.join(UI_DIR, 'Dialog.client.tsx');

/**
 * Every `styles.X` binding the component references, frozen. Splitting them
 * documents the classification a reader would otherwise have to re-derive.
 *
 * SLOTS are the containers a consumer opts into; each pads itself, so a panel
 * containing one must NOT add the fallback on top. Every name here has to
 * appear in the CSS `:has()` rule.
 *
 * NON_SLOTS live inside a slot (or are chrome positioned against the panel).
 * They never suppress the fallback.
 */
const SLOT_CLASSES = ['header', 'body', 'bodyBare', 'footer'] as const;
const NON_SLOT_CLASSES = ['overlay', 'panel', 'title', 'closeButton', 'closeButtonFloating'];

/** Matches the `.panel { … }` rule body (first declaration block only). */
const PANEL_RULE = /^\.panel\s*\{([^}]*)\}/m;

/** A `padding` declaration whose value is not a bare zero. */
const NONZERO_PADDING = /\bpadding\s*:\s*(?!0\s*[;}])[^;}]+/;

/** The opt-out rule: a `:has()` selector on `.panel` that zeroes padding. */
const HAS_OPTOUT_RULE = /((?:\.panel:has\([^)]*\)\s*,?\s*)+)\{([^}]*)\}/m;

/** Strips `/* … *\/` comments so commented-out CSS cannot satisfy a check. */
function stripComments(css: string): string {
    return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('dialog panel padding (HOS-1235 static guard)', () => {
    const css = stripComments(fs.readFileSync(CSS_PATH, 'utf8'));
    const tsx = fs.readFileSync(TSX_PATH, 'utf8');

    it('the .panel rule declares a non-zero padding fallback', () => {
        const rule = PANEL_RULE.exec(css);

        expect(
            rule,
            `Could not find a top-level ".panel { … }" rule in ${path.basename(CSS_PATH)}. ` +
                'This guard resolves the fallback padding from that rule; a rename means ' +
                'the guard is now checking nothing and must be updated with the new selector.'
        ).not.toBeNull();

        expect(
            NONZERO_PADDING.test(rule?.[1] ?? ''),
            'The shared dialog .panel no longer declares a non-zero padding. That padding is ' +
                'the only thing standing between a dialog built from bare children and a ' +
                'heading rendered at 0px from the panel corner (HOS-1235 — it shipped that way ' +
                'on the commerce plan picker). If a dialog needs no padding, it should compose ' +
                'the DialogHeader/DialogBody/DialogFooter slots, which opt out via :has().'
        ).toBe(true);
    });

    it('a :has() rule zeroes that padding for panels using the structural slots', () => {
        const rule = HAS_OPTOUT_RULE.exec(css);

        expect(
            rule,
            'Could not find a ".panel:has(…) { … }" rule. Without it, every dialog composing ' +
                'DialogHeader/DialogBody/DialogFooter takes the panel fallback ON TOP of the ' +
                "slots' own padding — doubling the gutters and insetting the header/footer " +
                'separators away from the panel edge on all thirteen of them.'
        ).not.toBeNull();

        expect(
            /\bpadding\s*:\s*0\s*[;}]/.test(rule?.[2] ?? ''),
            'The .panel:has(…) rule exists but no longer sets "padding: 0", so it does not ' +
                'actually opt slotted dialogs out of the fallback.'
        ).toBe(true);
    });

    it('every structural slot is listed in the :has() opt-out', () => {
        const selector = HAS_OPTOUT_RULE.exec(css)?.[1] ?? '';

        // Read the slots out of the `:has(…)` ARGUMENTS rather than requiring
        // one standalone `.panel:has(.slot)` clause each. Collapsing the four
        // clauses into `.panel:has(.header, .body, …)` is equivalent CSS, and a
        // guard that reddened on that refactor would be training people to
        // distrust it. The negative lookahead keeps `.body` from matching
        // inside `.bodyBare`.
        const listed = [...selector.matchAll(/:has\(([^)]*)\)/g)].map((m) => m[1]).join(',');

        const unlisted = SLOT_CLASSES.filter(
            (slot) => !new RegExp(`\\.${slot}(?![\\w-])`).test(listed)
        );

        expect(
            unlisted,
            'These structural slots are not listed in the .panel:has(…) opt-out, so a dialog ' +
                'using one takes the panel fallback on top of the padding the slot already ' +
                'applies:\n  ' +
                unlisted.join('\n  ')
        ).toEqual([]);
    });

    it('the transparent variant re-zeroes padding, and does so after the :has() rule', () => {
        const hasIndex = css.search(HAS_OPTOUT_RULE);
        const transparentMatch = /\.panel\[data-variant="transparent"\]\s*\{([^}]*)\}/.exec(css);

        expect(
            transparentMatch,
            'The .panel[data-variant="transparent"] rule is gone. The image lightbox relies on ' +
                'it to surrender the panel chrome.'
        ).not.toBeNull();

        expect(
            /\bpadding\s*:\s*0\s*[;}]/.test(transparentMatch?.[1] ?? ''),
            'The transparent panel variant no longer zeroes padding. The lightbox passes a ' +
                '<DialogBody bare>, so it would otherwise take the fallback and inset the ' +
                'image by 20px of invisible chrome on a transparent surface.'
        ).toBe(true);

        expect(
            (transparentMatch?.index ?? -1) > hasIndex,
            'The .panel[data-variant="transparent"] rule must appear AFTER the .panel:has(…) ' +
                'rule. The two selectors match on specificity, so source order is the only ' +
                'thing deciding which wins — move it back below.'
        ).toBe(true);
    });

    it('the component references exactly the frozen set of style classes', () => {
        const referenced = [...tsx.matchAll(/\bstyles\.([A-Za-z0-9_]+)/g)].map((m) => m[1]);
        const actual = [...new Set(referenced)].sort();
        const expected = [...SLOT_CLASSES, ...NON_SLOT_CLASSES].sort();

        expect(
            actual,
            'The set of styles.* classes used by Dialog.client.tsx changed. This guard cannot ' +
                'tell a structural slot (which must opt out of the panel padding via :has()) ' +
                'from a child element (which must not) by reading JSX — so any change lands ' +
                'here for a human to classify.\n\n' +
                'If you added a SLOT: add it to SLOT_CLASSES here AND to the .panel:has(…) rule ' +
                'in Dialog.module.css.\n' +
                'If you added a child element: add it to NON_SLOT_CLASSES here and change ' +
                'nothing in the CSS.\n' +
                'If you removed one: drop it from whichever list holds it.'
        ).toEqual(expected);
    });
});
