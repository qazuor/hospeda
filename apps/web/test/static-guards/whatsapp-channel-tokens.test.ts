/**
 * @file whatsapp-channel-tokens.test.ts
 * @description Static guard for HOS-314 — every WhatsApp-styled surface in web
 * gets its colors from the `--channel-whatsapp*` design tokens, never from a
 * hard-coded brand hex, and never paints text on the brand green without the
 * AA-safe ink.
 *
 * WHY A GUARD AND NOT JUST A FIX: before HOS-314 the WhatsApp green lived as a
 * raw `#25d366` literal in THREE unrelated files (accommodation contact block,
 * experience contact CTA, newsletter broadcast CTA) with no shared source. Two
 * of them additionally hard-coded `color: white` on top of it — the pairing
 * that fails WCAG AA at 1.98:1 and is the actual defect this issue fixed. A
 * pass that touches one file leaves the other two diverging, which is the same
 * shape of bug HOS-289 had just finished fixing across four `wa.me` builders.
 * The three existing component tests made it worse: each one ASSERTED the
 * hard-coded hex (`expect(src).toContain('#25d366')`), so the divergence was
 * certified by CI rather than caught by it.
 *
 * WHAT IT ENFORCES
 *   1. No file under `apps/web/src` contains a WhatsApp color literal — the
 *      brand's published hexes, the hexes the OKLCH tokens actually RENDER to
 *      (which differ by one 8-bit step and are what a developer copies out of
 *      DevTools), and the `rgb()` spellings of both.
 *   2. FORM, not mere mention: every rule that paints the WhatsApp fill also
 *      takes its text color from a channel ink token, in the same rule. A file
 *      that references the token somewhere while a rule keeps `color: white`
 *      would satisfy a naive "does it mention the token" check and still ship
 *      the 1.98:1 pairing.
 *   3. `apps/web` may CONSUME the theme-invariant channel tokens but never
 *      DECLARE them. A `[data-theme="dark"] .acc-whatsapp__btn { --channel-
 *      whatsapp-foreground: ... }` rule outranks `:root`, leaves the tokens
 *      package untouched, and would take the button to 1.57:1 with every other
 *      assertion here still green. That pattern is live in six other files in
 *      this app, so it is a real route, not a contrived one.
 *
 * TWO EXEMPTIONS, BOTH TESTED. Escape hatches are where static guards go blind,
 * so each one has its own cases in the "exemptions" suite below:
 *   - COMMENTS are exempt from every rule, because the fix documents the
 *     rejected hexes in prose ("`#128c7e` reads 3.57:1"). A guard that counted
 *     those would go red on the very explanation of why it exists. NOTE the
 *     stripping applies to the pairing rule too: an earlier revision stripped
 *     comments for rule 1 only, which let comment prose SATISFY the pairing
 *     requirement while the live rule kept `color: white`.
 *   - The LOGO ink (`--channel-whatsapp-logo`, white) is accepted as the ink
 *     for exactly the rules enumerated in `LOGO_INK_ALLOWLIST`. WCAG 1.4.3
 *     exempts logotypes, so a badge holding only the WhatsApp mark keeps it
 *     white; a labelled CTA cannot, because its text and glyph share
 *     `currentColor`. The allowlist is checked for staleness in both
 *     directions — an entry that no longer matches a real rule fails, and a
 *     rule using the logo ink without an entry fails.
 *
 * WHAT IT DOES **NOT** SEE — stated so nobody mistakes a green run for
 * broader coverage than this is:
 *   - The contrast ratios themselves. Whether the token VALUES clear AA lives
 *     in `packages/design-tokens/src/tokens/channel-contrast.test.ts`; this
 *     guard only proves the surfaces consume the tokens.
 *   - Hover and focus states, inline `style=` attributes, colors assigned from
 *     JavaScript, `hsl()`/`color()`/named-color spellings of the brand green,
 *     and any WhatsApp surface styled with a non-WhatsApp green (e.g.
 *     `var(--success)`), which no literal pattern can detect.
 *   - A hex written after a `//` on the same line as real code in a `.ts`/
 *     `.tsx` file. Line-comment stripping is restricted to those extensions
 *     precisely because CSS has no `//` comment while it does have `url(//…)`
 *     and `data:;base64,…//…` values that would otherwise be treated as one.
 *   - `apps/admin` and other packages: no admin surface renders a WhatsApp CTA.
 *
 * @module test/static-guards/whatsapp-channel-tokens
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_SRC = path.resolve(__dirname, '../../src');

/** File extensions that can carry CSS declarations in this app. */
const SCANNED_EXTENSIONS = new Set(['.astro', '.css', '.ts', '.tsx']);

/** Extensions where `//` starts a comment. CSS is deliberately excluded. */
const LINE_COMMENT_EXTENSIONS = new Set(['.ts', '.tsx']);

/**
 * WhatsApp color literals that must never appear in code. Both spellings of
 * each: the hex the brand publishes AND the hex the OKLCH token renders to,
 * which differ by one 8-bit step — the rendered one is what a developer pastes
 * after reading the computed color of the shipped element in DevTools.
 */
const FORBIDDEN_LITERALS: ReadonlyArray<{ readonly label: string; readonly pattern: RegExp }> = [
    {
        label: 'brand green, published or as rendered (use --channel-whatsapp)',
        pattern: /#2[56]d366\b|rgb\(\s*3[78][\s,]+211[\s,]+102/i
    },
    {
        label: 'hover green, published or as rendered (use --channel-whatsapp-hover)',
        pattern: /#1[ef]be5d\b|rgb\(\s*3[01][\s,]+190[\s,]+93/i
    },
    {
        label: 'teal: brand #128c7e is 3.57:1 on --surface-warm (use --channel-whatsapp-text)',
        pattern: /#12[89]c7e\b|#146c61\b|rgb\(\s*(?:18|20)[\s,]+140[\s,]+126/i
    },
    {
        label: 'dark green: replaces the brand green instead of the ink (rejected in HOS-314)',
        pattern: /#075e54\b|#095e54\b/i
    }
];

/** The fill token whose every use must be paired with a channel ink token. */
const FILL_TOKEN = '--channel-whatsapp';
/** The AA-safe ink for text and glyphs on the fill. */
const FOREGROUND_TOKEN = '--channel-whatsapp-foreground';
/** The logotype ink (white); only valid for the allowlisted rules below. */
const LOGO_TOKEN = '--channel-whatsapp-logo';

/**
 * Tokens `apps/web` may consume but must never declare. Re-declaring any of
 * them in app CSS is how the theme-invariance invariant gets broken without
 * touching the tokens package.
 */
const CONSUME_ONLY_TOKENS = [FILL_TOKEN, FOREGROUND_TOKEN, LOGO_TOKEN, `${FILL_TOKEN}-hover`];

/**
 * The only rules allowed to ink the fill with the white logotype token, with
 * the reason. Keep this list as short as the WCAG 1.4.3 exemption justifies:
 * a rule qualifies only if it contains the WhatsApp mark and NO text.
 */
const LOGO_INK_ALLOWLIST: ReadonlyArray<{
    readonly file: string;
    readonly selector: string;
    readonly reason: string;
}> = [
    {
        file: 'components/newsletter/WhatsAppCTA.module.css',
        selector: '.iconWrap',
        reason: '48px badge containing only the WhatsApp logotype — no text (WCAG 1.4.3)'
    }
];

/** How many rules paint the WhatsApp fill. Pinned exactly, see the test. */
const EXPECTED_FILL_RULES = 4;

/** Recursively collects scannable files under `dir`. */
function collectFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) {
        return [];
    }

    const files: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectFiles(fullPath));
            continue;
        }
        if (SCANNED_EXTENSIONS.has(path.extname(entry.name))) {
            files.push(fullPath);
        }
    }
    return files;
}

/**
 * Removes comment prose so the rules only ever look at code. Block and HTML
 * comments are stripped everywhere; `//` is treated as a comment opener only in
 * TS/TSX, since in CSS it appears inside ordinary values (`url(//cdn/x.png)`,
 * base64 data URIs) where stripping to end-of-line would blank real
 * declarations — and blanking a declaration makes this guard fail OPEN.
 *
 * Block comments go first: a `//` inside a block comment would otherwise
 * swallow that block's terminator and blank the rest of the file.
 */
function stripComments(source: string, extension: string): string {
    const withoutBlocks = source.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    return LINE_COMMENT_EXTENSIONS.has(extension)
        ? withoutBlocks.replace(/(?<![:/])\/\/[^\n]*/g, '')
        : withoutBlocks;
}

/** A CSS rule reduced to its selector and its OWN declarations. */
type Rule = { readonly selector: string; readonly body: string };

/**
 * Splits CSS-ish source into rules, keeping each rule's own declarations even
 * when it contains a nested block.
 *
 * The naive version of this — split on `}` and keep the text after the last
 * `{` — silently DELETES a rule's declarations as soon as anything is nested
 * inside it, so a rule that paints the fill and then nests an `@media` drops
 * out of the scan entirely instead of being reported. Native CSS nesting is
 * valid in both Astro `<style>` blocks and CSS modules here, so that is a
 * one-refactor-away hole, not a hypothetical.
 */
function parseRules(source: string): Rule[] {
    const rules: Rule[] = [];
    // Walk the source tracking brace depth, accumulating each level's OWN text.
    const stack: { selector: string; own: string }[] = [];
    let pending = '';

    /** The selector is whatever follows the previous declaration or brace. */
    const selectorOf = (text: string) =>
        text
            .split(/[;{}\n]/)
            .pop()
            ?.trim() ?? '';

    for (const char of source) {
        if (char === '{') {
            // Hand the enclosing rule the declarations seen so far BEFORE
            // descending — dropping them here is exactly how the naive version
            // made a violation invisible instead of reporting it.
            const parent = stack.at(-1);
            if (parent) {
                parent.own += pending;
            }
            stack.push({ selector: selectorOf(pending), own: '' });
            pending = '';
            continue;
        }
        if (char === '}') {
            const finished = stack.pop();
            if (finished) {
                rules.push({ selector: finished.selector, body: finished.own + pending });
            }
            // Whatever follows belongs to the rule we just returned to, which
            // keeps its pre-nesting declarations in `own`.
            pending = '';
            continue;
        }
        pending += char;
    }

    return rules.filter((rule) => rule.body.trim().length > 0);
}

/**
 * True when the rule paints the WhatsApp fill. Matches ANY `background*`
 * property (including `background-image` gradients and multi-value shorthands),
 * because every one of them puts the green behind the text.
 */
function paintsFill(body: string): boolean {
    return new RegExp(`background[a-z-]*\\s*:[^;]*var\\(\\s*${FILL_TOKEN}\\s*[,)]`).test(body);
}

/** True when the rule takes its text color from `token`. */
function usesInk(body: string, token: string): boolean {
    return new RegExp(`(?<!-)color\\s*:\\s*var\\(\\s*${token}\\s*[,)]`).test(body);
}

/** Reads a file with its comments stripped according to its extension. */
function readCode(file: string): string {
    return stripComments(fs.readFileSync(file, 'utf-8'), path.extname(file));
}

describe('HOS-314 static guard — WhatsApp surfaces consume the channel tokens', () => {
    const files = collectFiles(WEB_SRC);
    /** Every file read and comment-stripped once, then shared by all rules. */
    const code = new Map(files.map((file) => [file, readCode(file)]));
    const relative = (file: string) => path.relative(WEB_SRC, file);

    /** Every rule in the app that paints the WhatsApp fill. */
    const fillRules = [...code].flatMap(([file, source]) =>
        parseRules(source)
            .filter((rule) => paintsFill(rule.body))
            .map((rule) => ({ file: relative(file), ...rule }))
    );

    it('scans a non-empty set of web source files', () => {
        expect(files.length).toBeGreaterThan(0);
    });

    for (const { label, pattern } of FORBIDDEN_LITERALS) {
        it(`no source file hard-codes the ${label}`, () => {
            const offenders = [...code]
                .filter(([, source]) => pattern.test(source))
                .map(([file]) => relative(file));

            expect(offenders, `Files hard-coding a WhatsApp color instead of the token`).toEqual(
                []
            );
        });
    }

    describe('fill / ink pairing', () => {
        it(`finds exactly ${EXPECTED_FILL_RULES} rules painting the WhatsApp fill`, () => {
            // Pinned exactly, not as a floor: a floor one below the real count
            // tolerates a whole surface silently leaving the token path, which
            // is the very regression the pairing rule below exists to catch.
            // If a surface is legitimately added or removed, this number is the
            // place to say so out loud.
            expect(fillRules.map((rule) => `${rule.file} ${rule.selector}`).sort()).toHaveLength(
                EXPECTED_FILL_RULES
            );
        });

        it('every rule painting the fill inks its text from a channel token', () => {
            const unpaired = fillRules
                .filter(
                    (rule) =>
                        !usesInk(rule.body, FOREGROUND_TOKEN) && !usesInk(rule.body, LOGO_TOKEN)
                )
                .map((rule) => `${rule.file} ${rule.selector}`);

            expect(
                unpaired,
                `Rules painting var(${FILL_TOKEN}) without a channel ink token — white on the brand green is 1.98:1 (WCAG AA needs 4.5:1)`
            ).toEqual([]);
        });

        it('only the allowlisted rules ink the fill with the white logotype token', () => {
            const unlisted = fillRules
                .filter((rule) => usesInk(rule.body, LOGO_TOKEN))
                .filter(
                    (rule) =>
                        !LOGO_INK_ALLOWLIST.some(
                            (entry) => entry.file === rule.file && entry.selector === rule.selector
                        )
                )
                .map((rule) => `${rule.file} ${rule.selector}`);

            expect(
                unlisted,
                `Rules using var(${LOGO_TOKEN}) without an entry in LOGO_INK_ALLOWLIST — white ink is only exempt for a logotype with no text (WCAG 1.4.3)`
            ).toEqual([]);
        });

        it('every allowlist entry still describes a real rule (no stale exemptions)', () => {
            const stale = LOGO_INK_ALLOWLIST.filter(
                (entry) =>
                    !fillRules.some(
                        (rule) =>
                            rule.file === entry.file &&
                            rule.selector === entry.selector &&
                            usesInk(rule.body, LOGO_TOKEN)
                    )
            ).map((entry) => `${entry.file} ${entry.selector}`);

            expect(stale, 'Allowlist entries that no longer match a logo-inked rule').toEqual([]);
        });
    });

    describe('consume-only tokens', () => {
        it.each(CONSUME_ONLY_TOKENS)('no app rule re-declares %s', (token) => {
            const offenders = [...code]
                .filter(([, source]) => new RegExp(`${token}\\s*:`).test(source))
                .map(([file]) => relative(file));

            expect(
                offenders,
                `${token} is theme-invariant and owned by @repo/design-tokens; a declaration in app CSS outranks :root and can silently take the button to 1.57:1`
            ).toEqual([]);
        });
    });

    describe('exemptions (the escape hatches, tested)', () => {
        it('ignores a brand hex mentioned in a CSS block comment', () => {
            const css = '/* rejected: #128c7e is 3.57:1 */\n.a { color: var(--channel-whatsapp); }';
            expect(stripComments(css, '.css')).not.toContain('#128c7e');
        });

        it('ignores a brand hex mentioned in a TS line comment', () => {
            expect(
                stripComments('// white on #25d366 is 1.98:1\nconst a = 1;', '.ts')
            ).not.toContain('#25d366');
        });

        it('still catches a brand hex in a real declaration next to a comment', () => {
            const css = '/* HOS-314 */\n.a { background-color: #25d366; }';
            expect(stripComments(css, '.css')).toContain('#25d366');
        });

        it('does not let a line-comment marker inside a block comment blank the file', () => {
            const css = '/* see https://wa.me // note */\n.a { background-color: #25d366; }';
            expect(stripComments(css, '.css')).toContain('#25d366');
        });

        it('keeps CSS values that contain a double slash (url, data URI)', () => {
            // Stripping `//` in CSS would blank the rest of these lines, hiding
            // a real declaration — the guard would fail OPEN.
            const url = '.a { background: url(//cdn.x/i.png) #25d366; }';
            const data = '.a { background: url(data:image/png;base64,iVBOR//w0K); color: #25d366 }';
            expect(stripComments(url, '.css')).toContain('#25d366');
            expect(stripComments(data, '.css')).toContain('#25d366');
        });

        it('strips comments for the PAIRING rule too, not only the hex rule', () => {
            // The defect this case exists for: with the raw source, the commented
            // token satisfied the pairing requirement while the live declaration
            // kept `color: white`.
            const css =
                '.a { background-color: var(--channel-whatsapp); color: white; /* was color: var(--channel-whatsapp-foreground) */ }';
            const [rule] = parseRules(stripComments(css, '.css'));
            expect(rule && paintsFill(rule.body)).toBe(true);
            expect(rule && usesInk(rule.body, FOREGROUND_TOKEN)).toBe(false);
        });

        it('does not manufacture a phantom fill rule out of a comment', () => {
            const css = '.a { /* background-color: var(--channel-whatsapp); */ color: red; }';
            const rules = parseRules(stripComments(css, '.css'));
            expect(rules.filter((rule) => paintsFill(rule.body))).toEqual([]);
        });
    });

    describe('rule parsing (the other place this guard can go blind)', () => {
        it("keeps a rule's own declarations when it contains a nested block", () => {
            // The naive split-on-brace version dropped these, turning a real
            // violation into invisibility rather than into a failure.
            const css =
                '.a { background-color: var(--channel-whatsapp); color: white; @media (min-width: 900px) { letter-spacing: 0.01em; } }';
            const offending = parseRules(css).filter(
                (rule) => paintsFill(rule.body) && !usesInk(rule.body, FOREGROUND_TOKEN)
            );
            expect(offending).toHaveLength(1);
        });

        it('sees the fill in a gradient or a background shorthand', () => {
            const gradient =
                '.a { background-image: linear-gradient(var(--channel-whatsapp), var(--channel-whatsapp-hover)); color: white; }';
            const shorthand = '.b { background: no-repeat var(--channel-whatsapp); color: white; }';
            expect(parseRules(gradient).filter((rule) => paintsFill(rule.body))).toHaveLength(1);
            expect(parseRules(shorthand).filter((rule) => paintsFill(rule.body))).toHaveLength(1);
        });

        it('does not confuse a --*-color custom property with the color property', () => {
            const css =
                '.a { background-color: var(--channel-whatsapp); --x-color: var(--channel-whatsapp-foreground); }';
            const [rule] = parseRules(css);
            expect(rule && usesInk(rule.body, FOREGROUND_TOKEN)).toBe(false);
        });
    });
});
