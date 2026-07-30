/**
 * @file whatsapp-channel-tokens.test.ts
 * @description Static guard for HOS-314 — every WhatsApp-styled surface in web
 * gets its colors from the `--channel-whatsapp*` design tokens, never from a
 * hard-coded brand hex.
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
 *   1. No file under `apps/web/src` contains a WhatsApp brand hex literal —
 *      including the two shades that were measured and rejected during
 *      HOS-314 (`#128c7e`, `#075e54`), so a future "fix" cannot reintroduce a
 *      hard-code by reaching for a different WhatsApp green.
 *   2. FORM, not mere mention: every CSS rule that paints the WhatsApp fill
 *      (`background[-color]: var(--channel-whatsapp)`) also sets its text
 *      color from `var(--channel-whatsapp-foreground)` in the SAME rule block.
 *      A file that references the token somewhere while a rule keeps
 *      `color: white` would satisfy a naive "does it mention the token" check
 *      and still ship the 1.98:1 pairing.
 *
 * COMMENTS ARE EXEMPT, and the exemption is itself tested. Rule 1 scans code
 * with comments stripped, because the fix for this issue documents the rejected
 * hexes in prose ("`#128c7e` reads 3.57:1 on --surface-warm") — a guard that
 * counted those would go red on the very explanation of why it exists, i.e.
 * fail on correct code, which is how guards end up deleted. An exemption is
 * also where a guard silently stops seeing things, so `stripComments` and the
 * matcher have their own unit tests below rather than being trusted.
 *
 * WHAT IT DOES **NOT** SEE — stated so nobody mistakes a green run for
 * broader coverage than this is:
 *   - The contrast ratios themselves. Whether the token VALUES clear AA lives
 *     in `packages/design-tokens/src/tokens/channel-contrast.test.ts`; this
 *     guard only proves the surfaces consume the tokens.
 *   - A hex written after a `//` on the same line as real code: line-comment
 *     stripping removes the rest of that line. Impossible inside a CSS
 *     declaration, which is the only place a color literal can take effect.
 *   - Hover / focus states, inline `style=` attributes, colors assigned from
 *     JavaScript, and any WhatsApp surface styled with a non-WhatsApp green
 *     (e.g. `var(--success)`), which no hex pattern can detect.
 *   - `apps/admin` and other packages (out of this issue's scope: no admin
 *     surface renders a WhatsApp CTA today).
 *
 * @module test/static-guards/whatsapp-channel-tokens
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_SRC = path.resolve(__dirname, '../../src');

/** File extensions that can carry CSS declarations in this app. */
const SCANNED_EXTENSIONS = new Set(['.astro', '.css', '.ts', '.tsx']);

/**
 * WhatsApp brand hexes that must never appear as literals. `#` is required in
 * the pattern so an unrelated hash or id that happens to contain the same six
 * characters is not reported.
 */
const FORBIDDEN_HEXES: ReadonlyArray<{ readonly label: string; readonly hex: string }> = [
    { label: 'brand green (use --channel-whatsapp)', hex: '#25d366' },
    { label: 'hover green (use --channel-whatsapp-hover)', hex: '#1ebe5d' },
    { label: 'teal, 3.57:1 on --surface-warm (use --channel-whatsapp-text)', hex: '#128c7e' },
    { label: 'dark green, rejected in HOS-314 (changes the brand color)', hex: '#075e54' }
];

/** The fill token whose every use must be paired with the foreground token. */
const FILL_TOKEN = '--channel-whatsapp';
/** The readable-on-green ink token that must accompany the fill. */
const FOREGROUND_TOKEN = '--channel-whatsapp-foreground';

/**
 * How many rule blocks paint the WhatsApp fill today (accommodation button,
 * newsletter icon circle, newsletter CTA — the experience CTA is a fourth,
 * dormant one). A canary: if the pairing rule below stops finding blocks it
 * would pass vacuously, so the count is asserted separately.
 */
const MIN_FILL_BLOCKS = 3;

/**
 * Removes comment prose so rule 1 only ever looks at code. Order matters:
 * block comments are stripped FIRST, because a line-comment marker sitting
 * inside a block comment would otherwise swallow that block's terminator and
 * blank the rest of the file. The lookbehind on the line-comment pattern keeps
 * `https://` — and the second slash of the marker itself — from being mistaken
 * for a comment opener.
 *
 * Asserted directly in the "comment exemption" suite below: an untested
 * exemption is the usual place a static guard goes blind.
 */
function stripComments(source: string): string {
    return source
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(?<![:/])\/\/[^\n]*/g, '');
}

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
 * Splits CSS-ish source into rule bodies. Declarations are what matters here,
 * so each `{ ... }` body is treated as one block; nested at-rules simply yield
 * an extra (harmless) empty block. Good enough to answer "are these two
 * declarations in the same rule".
 */
function ruleBodies(content: string): string[] {
    return content
        .split('}')
        .map((chunk) => {
            const brace = chunk.lastIndexOf('{');
            return brace === -1 ? '' : chunk.slice(brace + 1);
        })
        .filter((body) => body.trim().length > 0);
}

/** True when the body paints the WhatsApp fill as its background. */
function paintsFill(body: string): boolean {
    return new RegExp(`background(?:-color)?\\s*:\\s*var\\(\\s*${FILL_TOKEN}\\s*[,)]`).test(body);
}

/** True when the body takes its text color from the channel foreground token. */
function usesChannelForeground(body: string): boolean {
    return new RegExp(`(?<!-)color\\s*:\\s*var\\(\\s*${FOREGROUND_TOKEN}\\s*[,)]`).test(body);
}

describe('HOS-314 static guard — WhatsApp surfaces consume the channel tokens', () => {
    const files = collectFiles(WEB_SRC);

    it('scans a non-empty set of web source files', () => {
        expect(files.length).toBeGreaterThan(0);
    });

    for (const { label, hex } of FORBIDDEN_HEXES) {
        it(`no source file hard-codes ${hex} — ${label}`, () => {
            const offenders = files
                .filter((file) =>
                    stripComments(fs.readFileSync(file, 'utf-8')).toLowerCase().includes(hex)
                )
                .map((file) => path.relative(WEB_SRC, file));

            expect(offenders, `Files hard-coding ${hex} instead of the channel token`).toEqual([]);
        });
    }

    describe('comment exemption (the escape hatch, tested)', () => {
        it('ignores a brand hex mentioned in a CSS block comment', () => {
            const css = '/* rejected: #128c7e is 3.57:1 */\n.a { color: var(--channel-whatsapp); }';
            expect(stripComments(css)).not.toContain('#128c7e');
        });

        it('ignores a brand hex mentioned in a line comment', () => {
            expect(stripComments('// white on #25d366 is 1.98:1\nconst a = 1;')).not.toContain(
                '#25d366'
            );
        });

        it('still catches a brand hex in a real declaration next to a comment', () => {
            const css = '/* HOS-314 */\n.a { background-color: #25d366; }';
            expect(stripComments(css)).toContain('#25d366');
        });

        it('does not let a line-comment marker inside a block comment blank the file', () => {
            // The failure mode this ordering exists to avoid: stripping line
            // comments first would eat the block terminator and everything after.
            const css = '/* see https://wa.me // note */\n.a { background-color: #25d366; }';
            expect(stripComments(css)).toContain('#25d366');
        });

        it('does not treat a URL as a comment opener', () => {
            expect(stripComments("const u = 'https://wa.me'; // trailing")).toContain(
                'https://wa.me'
            );
        });
    });

    describe('fill / foreground pairing', () => {
        const fillBlocks = files.flatMap((file) =>
            ruleBodies(fs.readFileSync(file, 'utf-8'))
                .filter(paintsFill)
                .map((body) => ({ file: path.relative(WEB_SRC, file), body }))
        );

        it(`finds at least ${MIN_FILL_BLOCKS} rules painting the WhatsApp fill`, () => {
            // Non-vacuity canary for the assertion below: it can only catch an
            // unpaired rule if it is actually looking at rules.
            expect(fillBlocks.length).toBeGreaterThanOrEqual(MIN_FILL_BLOCKS);
        });

        it('every rule painting the fill also sets color from the foreground token', () => {
            const unpaired = fillBlocks
                .filter(({ body }) => !usesChannelForeground(body))
                .map(({ file }) => file);

            expect(
                unpaired,
                `Rules painting var(${FILL_TOKEN}) without var(${FOREGROUND_TOKEN}) — white on the brand green is 1.98:1 (WCAG AA needs 4.5:1)`
            ).toEqual([]);
        });
    });
});
