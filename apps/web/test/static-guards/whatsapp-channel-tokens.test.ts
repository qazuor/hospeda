/**
 * @file whatsapp-channel-tokens.test.ts
 * @description Static guard for HOS-314 — the WhatsApp brand colors exist only as
 * `--channel-whatsapp*` design tokens, and only the three components that own a
 * WhatsApp surface may touch them.
 *
 * WHY A GUARD: before HOS-314 the WhatsApp green was a raw `#25d366` literal in
 * THREE unrelated components with no shared source, two of them with
 * `color: white` on top — the 1.98:1 pairing this issue fixed. A pass that
 * touches one file leaves the others diverging, the same shape of bug HOS-289
 * had just fixed across four `wa.me` builders. Worse, the three component tests
 * ASSERTED the hard-coded hex, so CI certified the divergence instead of
 * catching it. Preventing that recurrence is this file's whole job.
 *
 * WHAT IT DELIBERATELY DOES NOT DO — read this before extending it.
 * Three earlier revisions also tried to enforce the PAIRING (that a rule painting
 * the green inks its text from the AA-safe token). Three rounds of adversarial
 * review defeated all three, every time with a fail-open, and the last one is the
 * reason the ambition was dropped rather than patched again:
 *
 *   1. comment prose satisfied the pairing requirement (the pairing rule read raw
 *      bytes while only the literal rule stripped comments);
 *   2. the logo-ink allowlist was filtered over "rules that also paint the fill",
 *      so inking a CHILD element with the white logotype token was policed by
 *      nothing;
 *   3. the killer: locating a rule by selector reads the FIRST match, while the
 *      CSS cascade is decided by the LAST. A duplicate selector, a descendant, an
 *      `:is()`, a `@media` re-declaration or a child rule silently overrides the
 *      ink — and `WhatsAppCTA.module.css` already contains a second `.cta` rule
 *      inside `@media (max-width: 600px)`. Worse, the override needs no token at
 *      all: plain `color: white` names nothing, so a reference-counting closure
 *      cannot see it, and `-webkit-text-fill-color` beats `color` outright.
 *
 * Policing that correctly means resolving the cascade, which is a CSS engine's
 * job and not a regex's. So the pairing invariant now lives where it can be
 * checked without cascade reasoning at all — in each component's own test, as a
 * whole-file rule: no `color` in those three files may be anything but a
 * `var()`. That is cascade-proof (position stops mattering) and covers every
 * spelling of white at once. See:
 *   - `test/components/accommodation/WhatsAppContact.test.ts`
 *   - `test/components/experience/ExperienceContactCTA.test.ts`
 *   - `test/components/newsletter/WhatsAppCTA.test.ts`
 * and `packages/design-tokens/src/tokens/channel-contrast.test.ts` for the ratios.
 *
 * WHAT REMAINS HERE — the two rules that need no cascade reasoning:
 *   1. LITERALS — no WhatsApp color spelled out anywhere in `apps/web/src`, in
 *      any hex or `rgb()`/`rgba()` form, covering both the hexes the brand
 *      publishes and the ones the OKLCH tokens actually render to (they differ by
 *      one 8-bit step, and the rendered one is what a developer copies out of
 *      DevTools). This is the exact regression that motivated the issue.
 *   2. OWNERSHIP — only the three owning components may name the tokens, and even
 *      they may never DECLARE them (a declaration in app CSS outranks `:root` and
 *      can retheme the brand ink without touching `@repo/design-tokens`).
 *
 * STILL NOT SEEN, stated plainly: `hsl()`/`color()`/named-color spellings of the
 * brand green; a WhatsApp surface painted with a non-WhatsApp green
 * (`var(--success)`); anything outside `apps/web/src` (no admin surface renders a
 * WhatsApp CTA); and non-CSS-ish extensions (`.js`, `.md`, `public/`), none of
 * which carry a color declaration in this app today.
 *
 * @module test/static-guards/whatsapp-channel-tokens
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_SRC = path.resolve(__dirname, '../../src');

/** File extensions that can carry a color declaration in this app. */
const SCANNED_EXTENSIONS = new Set(['.astro', '.css', '.ts', '.tsx']);

/**
 * Lower bound on the scan size. `> 0` would let a mis-resolved `WEB_SRC` pointing
 * at a one-file directory pass while voiding both rules below.
 */
const MIN_SCANNED_FILES = 500;

/** The token family this guard owns. */
const TOKEN_PREFIX = '--channel-whatsapp';
/**
 * Astro's `define:vars` writes custom-property keys WITHOUT the `--` prefix and
 * adds it itself, so closing this family means matching the bare name too.
 */
const BARE_TOKEN_PREFIX = 'channel-whatsapp';

/**
 * The three components that own a WhatsApp surface. Only these may name the
 * tokens; each has its own test asserting how it inks them.
 */
const OWNING_FILES: readonly string[] = [
    'components/accommodation/WhatsAppContact.astro',
    'components/experience/ExperienceContactCTA.astro',
    'components/newsletter/WhatsAppCTA.module.css'
];

/**
 * The exact multiset of `var(--channel-whatsapp*)` references each owning file may
 * contain. Not a pairing check — it cannot see a literal override, and does not
 * claim to. What it does catch is a token-named reference appearing somewhere new,
 * which is worth a line of review.
 */
const EXPECTED_REFERENCES: Readonly<Record<string, Readonly<Record<string, number>>>> = {
    'components/accommodation/WhatsAppContact.astro': {
        '--channel-whatsapp': 1,
        '--channel-whatsapp-foreground': 1,
        '--channel-whatsapp-hover': 1,
        '--channel-whatsapp-text': 1
    },
    'components/experience/ExperienceContactCTA.astro': {
        '--channel-whatsapp': 1,
        '--channel-whatsapp-foreground': 1,
        '--channel-whatsapp-hover': 1
    },
    'components/newsletter/WhatsAppCTA.module.css': {
        '--channel-whatsapp': 2,
        '--channel-whatsapp-foreground': 1,
        '--channel-whatsapp-logo': 1,
        '--channel-whatsapp-hover': 1
    }
};

/** WhatsApp color literals that must never be spelled out. */
const FORBIDDEN_LITERALS: ReadonlyArray<{ readonly label: string; readonly pattern: RegExp }> = [
    {
        label: 'brand green #25d366 / rendered #26d366 (use --channel-whatsapp)',
        pattern: /#2[56]d366\b|rgba?\(\s*3[78][\s,]+211[\s,]+102/i
    },
    {
        label: 'hover green #1ebe5d / rendered #1fbe5d (use --channel-whatsapp-hover)',
        pattern: /#1[ef]be5d\b|rgba?\(\s*3[01][\s,]+190[\s,]+93/i
    },
    {
        label: 'teal #128c7e and the rendered light/dark text tokens #146c61 / #4cc5b4',
        pattern:
            /#12[89]c7e\b|#146c61\b|#4cc5b4\b|rgba?\(\s*(?:18[\s,]+140[\s,]+126|20[\s,]+108[\s,]+97|76[\s,]+197[\s,]+180)/i
    },
    {
        label: 'dark green #075e54 — replaces the brand green instead of the ink (rejected)',
        pattern: /#0[79]5e54\b/i
    }
];

/**
 * Ways a custom property can be DECLARED, which the owning files must never do.
 * Enumerated because they do not share a syntax: a colon follows the name in CSS,
 * Astro `style=` and quoted TSX object literals; `setProperty` uses a comma;
 * `@property` uses a block; `define:vars` drops the `--` entirely.
 */
const DECLARATION_SPELLINGS: ReadonlyArray<{ readonly label: string; readonly pattern: RegExp }> = [
    {
        label: 'CSS / style= / TSX object literal',
        pattern: /--channel-whatsapp[a-z0-9-]*["'`]?\s*:/
    },
    { label: 'setProperty()', pattern: /setProperty\(\s*["'`]--channel-whatsapp/ },
    { label: '@property registration', pattern: /@property\s+--channel-whatsapp/ },
    {
        label: 'Astro define:vars (key without the -- prefix)',
        pattern: /define:vars[\s\S]{0,200}?["'`]?channel-whatsapp/
    }
];

/**
 * Removes comment PROSE, and nothing else.
 *
 * Only comments that OPEN A LINE are stripped. That is deliberate: the previous
 * revision tracked string state to decide whether a `/*` was real, and a single
 * unbalanced quote inside a JS regex literal (`.replace(/"/g, …)`) inverted the
 * parity for the rest of the file — three files in this tree already end in that
 * state. Line-leading is a property no quote can forge, so there is no state
 * machine and nothing to invert. It also leaves string contents alone by
 * construction, which is what `pages/robots.txt.ts` needed: it holds a glob
 * string for `verify-email-sent` that begins with slash-star-slash, and a
 * stripper reading that as a comment opener blanked 429 characters of real code.
 * Blanked code cannot be scanned, and unscanned code passes.
 * (That string is not reproduced literally here — it closes a block comment.)
 *
 * Cost, stated: a comment trailing real code on the same line is NOT stripped, so
 * a WhatsApp hex written there would be reported. Every prose mention in this repo
 * is line-leading, and being reported is the safe direction anyway.
 */
function stripLeadingComments(source: string): string {
    return source
        .replace(/^[ \t]*<!--[\s\S]*?-->/gm, '')
        .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, '')
        .replace(/^[ \t]*\/\/[^\n]*/gm, '');
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
 * Counts `var(--channel-whatsapp*)` references by exact token name. The suffix
 * pattern allows digits and several segments: `(?:-[a-z]+)?` matched only the five
 * tokens that exist today, so the first `--channel-whatsapp-text-dark` would have
 * dropped silently out of the multiset.
 */
function countTokenReferences(source: string): Record<string, number> {
    const counts: Record<string, number> = {};
    const pattern = new RegExp(`var\\(\\s*(${TOKEN_PREFIX}(?:-[a-z0-9]+)*)\\s*[,)]`, 'g');
    for (const match of source.matchAll(pattern)) {
        const token = match[1] as string;
        counts[token] = (counts[token] ?? 0) + 1;
    }
    return counts;
}

describe('HOS-314 static guard — WhatsApp colors live only in the channel tokens', () => {
    const files = collectFiles(WEB_SRC);
    const code = new Map(
        files.map((file) => [
            path.relative(WEB_SRC, file),
            stripLeadingComments(fs.readFileSync(file, 'utf-8'))
        ])
    );

    it(`scans at least ${MIN_SCANNED_FILES} web source files`, () => {
        expect(files.length).toBeGreaterThan(MIN_SCANNED_FILES);
    });

    describe('rule 1 — no WhatsApp color is spelled out as a literal', () => {
        for (const { label, pattern } of FORBIDDEN_LITERALS) {
            it(`no file hard-codes the ${label}`, () => {
                const offenders = [...code]
                    .filter(([, source]) => pattern.test(source))
                    .map(([file]) => file);

                expect(
                    offenders,
                    'files hard-coding a WhatsApp color instead of using the token'
                ).toEqual([]);
            });
        }
    });

    describe('rule 2 — only the owning components may touch the tokens', () => {
        it('every owning file exists and is scanned', () => {
            expect(OWNING_FILES.filter((file) => !code.has(file))).toEqual([]);
        });

        it('no other file names the tokens, in either spelling', () => {
            const offenders = [...code]
                .filter(
                    ([file, source]) =>
                        !OWNING_FILES.includes(file) &&
                        (source.includes(TOKEN_PREFIX) || source.includes(BARE_TOKEN_PREFIX))
                )
                .map(([file]) => file);

            expect(
                offenders,
                `files outside OWNING_FILES naming ${TOKEN_PREFIX} — a new WhatsApp surface needs its own component test asserting how it inks the green`
            ).toEqual([]);
        });

        for (const { label, pattern } of DECLARATION_SPELLINGS) {
            it(`no owning file declares a channel token — ${label}`, () => {
                const offenders = OWNING_FILES.filter((file) => pattern.test(code.get(file) ?? ''));

                expect(
                    offenders,
                    `${TOKEN_PREFIX}* is owned by @repo/design-tokens; declaring it in app CSS outranks :root and can take the button to 1.57:1`
                ).toEqual([]);
            });
        }

        it.each(OWNING_FILES)('%s references the tokens exactly as enumerated', (file) => {
            expect(countTokenReferences(code.get(file) ?? '')).toEqual(EXPECTED_REFERENCES[file]);
        });

        it('the reference map covers exactly the owning files', () => {
            expect(Object.keys(EXPECTED_REFERENCES).sort()).toEqual([...OWNING_FILES].sort());
        });
    });

    describe('the comment stripper', () => {
        it('exempts a line-leading block comment', () => {
            const css = '/* rejected: #128c7e is 3.57:1 */\n.a { color: var(--channel-whatsapp); }';
            expect(stripLeadingComments(css)).not.toContain('#128c7e');
        });

        it('exempts an indented line-leading block comment', () => {
            const css = '    /* white on #25d366 is 1.98:1 */\n    .a { color: red; }';
            expect(stripLeadingComments(css)).not.toContain('#25d366');
        });

        it('exempts a line-leading // comment', () => {
            expect(
                stripLeadingComments('// white on #25d366 is 1.98:1\nconst a = 1;')
            ).not.toContain('#25d366');
        });

        it('keeps a real declaration that follows a comment', () => {
            expect(stripLeadingComments('/* HOS-314 */\n.a { background: #25d366; }')).toContain(
                '#25d366'
            );
        });

        it('never treats a comment opener inside a value or string as a comment', () => {
            // None of these open a line, so no quote tracking is needed to know
            // they are not comments — which is the point of the rewrite.
            const url = '.a { background: url(//cdn.x/i.png) #25d366; }';
            const data = '.a { background: url(data:image/png;base64,iVBOR//w0K); color: #25d366 }';
            const str = "const p = ['/*/verify-email-sent'];\nconst c = '#25d366';";
            const rex = "const r = /\\/\\//;\nconst c = '#25d366';";
            for (const input of [url, data, str, rex]) {
                expect(stripLeadingComments(input)).toContain('#25d366');
            }
        });

        it('preserves the real file whose string literal broke the previous stripper', () => {
            const raw = fs.readFileSync(path.join(WEB_SRC, 'pages/robots.txt.ts'), 'utf-8');
            const stripped = stripLeadingComments(raw);
            // Both pins sit AFTER the phantom-comment opener, so both fail under a
            // quote-blind stripper. (An earlier version pinned an import above it,
            // which passed even with the bug.)
            expect(stripped).toContain("'/*/verify-email-sent'");
            expect(stripped).toContain('Disallow');
        });
    });

    describe('token reference counting', () => {
        it('counts a fallback and a nested var()', () => {
            expect(
                countTokenReferences('a { color: var(--channel-whatsapp-foreground, white); }')
            ).toEqual({ '--channel-whatsapp-foreground': 1 });
        });

        it('counts a multi-segment or digit-bearing suffix (future tokens)', () => {
            expect(countTokenReferences('a { color: var(--channel-whatsapp-text-dark); }')).toEqual(
                { '--channel-whatsapp-text-dark': 1 }
            );
        });
    });
});
