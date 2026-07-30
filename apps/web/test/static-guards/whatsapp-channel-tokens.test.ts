/**
 * @file whatsapp-channel-tokens.test.ts
 * @description Static guard for HOS-314 — the WhatsApp brand colors live in the
 * `--channel-whatsapp*` design tokens, every surface that paints the brand green
 * inks its text from the AA-safe channel token, and no other file in the app may
 * touch those tokens without being listed here.
 *
 * WHY A GUARD: before HOS-314 the WhatsApp green was a raw `#25d366` literal in
 * THREE unrelated components with no shared source, two of them with
 * `color: white` on top — the 1.98:1 pairing this issue fixed. A pass that
 * touches one file leaves the others diverging, the same shape of bug HOS-289
 * had just fixed across four `wa.me` builders. Worse, the three component tests
 * ASSERTED the hard-coded hex, so CI certified the divergence instead of
 * catching it.
 *
 * WHY IT IS SHAPED LIKE THIS — ENUMERATE AND CLOSE, NOT PARSE AND CHECK.
 * The first two revisions of this guard walked the whole tree, parsed CSS rules
 * and checked whatever it found. Two rounds of adversarial review defeated that
 * design six different ways, every one of them a FAIL-OPEN (the violation became
 * invisible instead of failing): a nested block swallowed a rule's declarations;
 * comment prose satisfied the pairing requirement; the logo-ink allowlist was
 * filtered over "rules that also paint the fill", so inking a child element was
 * unpoliced; one level of `--alias: var(--channel-whatsapp)` indirection escaped
 * the property matcher; a `}` inside a string desynchronised the brace walk; and
 * the ban list held the hexes the brand publishes rather than the ones the OKLCH
 * tokens render to. The root cause was hand-writing a CSS parser in a test.
 *
 * So the direction is inverted. There are exactly four WhatsApp surfaces and
 * they are listed in `SURFACES` below with the ink each must use. Two rules:
 *
 *   1. PAIRING — each listed rule is located by its own selector in its own
 *      file and must declare the fill and the expected ink. If the rule cannot
 *      be located (renamed, nested, reformatted), the test FAILS rather than
 *      silently finding nothing. That is the whole point: failure to read is a
 *      failure, not a pass.
 *   2. CLOSURE — no file outside `SURFACES` may so much as mention
 *      `--channel-whatsapp`, in any spelling. This one substring scan replaces
 *      every enumeration the previous design needed: an alias indirection, a
 *      `[data-theme="dark"]` override, a `{'--channel-whatsapp-logo': …}` TSX
 *      object literal, `define:vars`, `setProperty(…)`, or a brand-new surface
 *      all contain the token name, so all of them land here. Adding a real new
 *      surface means adding a line to `SURFACES` — which is exactly the review
 *      conversation that should happen.
 *
 * Plus the literal ban (no WhatsApp color spelled out as a hex or `rgb()`), which
 * needs no parsing either.
 *
 * WHAT IT DOES NOT SEE — stated so a green run is not mistaken for more:
 *   - The contrast ratios themselves: that is
 *     `packages/design-tokens/src/tokens/channel-contrast.test.ts`.
 *   - Hover and focus states of the listed rules (the component tests assert
 *     those; the pairing rule reads the base rule only).
 *   - `hsl()` / `color()` / named-color spellings of the brand green, and any
 *     WhatsApp surface painted with a non-WhatsApp green (`var(--success)`).
 *   - Whether the logotype badge really contains no text — see `SURFACES`; the
 *     newsletter component test asserts that separately.
 *   - `apps/admin`: no admin surface renders a WhatsApp CTA.
 *
 * @module test/static-guards/whatsapp-channel-tokens
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_SRC = path.resolve(__dirname, '../../src');

/** File extensions that can carry a color declaration in this app. */
const SCANNED_EXTENSIONS = new Set(['.astro', '.css', '.ts', '.tsx']);

/** The token family this guard owns. Any mention of this prefix is in scope. */
const TOKEN_PREFIX = '--channel-whatsapp';
/** AA-safe ink for text and glyphs on the brand green (9.12:1). */
const INK_AA = '--channel-whatsapp-foreground';
/** The WhatsApp logotype in white — valid only where there is no text. */
const INK_LOGO = '--channel-whatsapp-logo';

/**
 * Every rule in the app allowed to paint the WhatsApp fill, with the ink it
 * must use and why. This list IS the guard's model of the app: rule 2 forbids
 * the tokens everywhere else, so a new surface cannot appear without an entry.
 */
const SURFACES: ReadonlyArray<{
    readonly file: string;
    readonly selector: string;
    readonly ink: string;
    readonly reason: string;
}> = [
    {
        file: 'components/accommodation/WhatsAppContact.astro',
        selector: '.acc-whatsapp__btn',
        ink: INK_AA,
        reason: 'labelled CTA — label and glyph share currentColor'
    },
    {
        file: 'components/experience/ExperienceContactCTA.astro',
        selector: '.exp-contact-cta__whatsapp-btn',
        ink: INK_AA,
        reason: 'labelled CTA (dormant per HOS-363, kept in lockstep)'
    },
    {
        file: 'components/newsletter/WhatsAppCTA.module.css',
        selector: '.cta',
        ink: INK_AA,
        reason: 'labelled CTA'
    },
    {
        file: 'components/newsletter/WhatsAppCTA.module.css',
        selector: '.iconWrap',
        ink: INK_LOGO,
        reason: '48px badge holding only the logotype — WCAG 1.4.3 exempts logotypes'
    }
];

/**
 * The EXACT multiset of channel-token references each enumerated file may
 * contain, keyed by file.
 *
 * `SURFACES` closes the door from outside (no other file may touch the tokens);
 * this closes it from inside. Without it, adding
 * `.acc-whatsapp__btn > span { color: var(--channel-whatsapp-logo); }` to an
 * already-enumerated file ships white text on the brand green at 1.98:1 with
 * every other assertion green — the exact back door `colors.ts` promises is shut.
 * Counting references needs no parsing and catches any new rule, any theme
 * override and any spelling, because they all name the token.
 *
 * A legitimate edit (say, a `:focus-visible` that also swaps the fill) makes this
 * fail and asks for a line to be updated. That is the intended cost: the numbers
 * are the review surface.
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

/**
 * WhatsApp color literals that must never be spelled out. Each covers BOTH the
 * hex the brand publishes AND the hex the OKLCH token renders to — they differ
 * by one 8-bit step, and the rendered one is what a developer copies out of
 * DevTools after inspecting the shipped element. `rgba?\(` because any alpha
 * spelling is `rgba(`.
 */
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
        label: 'teal #128c7e (3.57:1 on --surface-warm) and the rendered light/dark text tokens',
        pattern:
            /#12[89]c7e\b|#146c61\b|#4cc5b4\b|rgba?\(\s*(?:18[\s,]+140[\s,]+126|20[\s,]+108[\s,]+97|76[\s,]+197[\s,]+180)/i
    },
    {
        label: 'dark green #075e54 — replaces the brand green instead of the ink (rejected)',
        pattern: /#0[79]5e54\b/i
    }
];

/**
 * Removes comment prose in ONE pass, tracking whether it is inside a string.
 *
 * Quote awareness is not a nicety here. Two rounds of review produced a
 * different fail-open for each naive ordering of two regex passes: stripping
 * `//` first eats the `*​/` that terminates a block comment containing a URL,
 * blanking the rest of the file; stripping `/* *​/` first blanks 429 characters
 * of real code in `pages/robots.txt.ts`, where the string `'/*​/verify-email-sent'`
 * opens a comment that never closes there. Blanked code cannot be scanned, and
 * unscanned code is a pass. A single pass that skips string contents has
 * neither problem, and it is asserted against that real file below.
 *
 * `//` opens a comment only outside CSS: in `.css` and inside an Astro `<style>`
 * block it is not a comment, while `url(//cdn/x.png)` and base64 data URIs
 * contain it. Astro frontmatter is TypeScript, so `.astro` gets `//` handling —
 * the cost is that a `//` inside a `<style>` value would truncate that line,
 * which is why the pairing rule locates rules by selector rather than trusting
 * a stripped stylesheet.
 */
function stripComments(source: string, extension: string): string {
    const lineCommentsApply = extension !== '.css';
    let out = '';
    let index = 0;
    let quote: string | null = null;

    while (index < source.length) {
        const char = source[index] as string;
        const next = source[index + 1];

        if (quote) {
            if (char === '\\') {
                out += char + (next ?? '');
                index += 2;
                continue;
            }
            if (char === quote) {
                quote = null;
            }
            out += char;
            index += 1;
            continue;
        }

        if (char === '"' || char === "'" || char === '`') {
            quote = char;
            out += char;
            index += 1;
            continue;
        }

        if (char === '/' && next === '*') {
            const end = source.indexOf('*/', index + 2);
            index = end === -1 ? source.length : end + 2;
            continue;
        }

        if (lineCommentsApply && char === '/' && next === '/') {
            const end = source.indexOf('\n', index);
            index = end === -1 ? source.length : end;
            continue;
        }

        if (char === '<' && source.startsWith('<!--', index)) {
            const end = source.indexOf('-->', index + 4);
            index = end === -1 ? source.length : end + 3;
            continue;
        }

        out += char;
        index += 1;
    }

    return out;
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
 * Returns the declaration block of `selector` — the text between its `{` and the
 * matching `}` — or `null` when the rule cannot be found. `null` is a FAILURE at
 * the call site, never a skip.
 */
function ruleBody(source: string, selector: string): string | null {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // The selector must start a rule: preceded by start-of-file, `}` or a
    // newline, so `.cta` does not match inside `.cta:hover` or `.other .cta`.
    const start = new RegExp(`(?:^|[}\\n])\\s*${escaped}\\s*\\{`, 'm').exec(source);
    if (!start) {
        return null;
    }

    let depth = 0;
    for (let index = start.index + start[0].length - 1; index < source.length; index += 1) {
        const char = source[index];
        if (char === '{') {
            depth += 1;
        } else if (char === '}') {
            depth -= 1;
            if (depth === 0) {
                return source.slice(start.index + start[0].length, index);
            }
        }
    }
    return null;
}

/** Counts `var(--channel-whatsapp*)` references in `source`, by exact token name. */
function countTokenReferences(source: string): Record<string, number> {
    const counts: Record<string, number> = {};
    const pattern = new RegExp(`var\\(\\s*(${TOKEN_PREFIX}(?:-[a-z]+)?)\\s*[,)]`, 'g');
    for (const match of source.matchAll(pattern)) {
        const token = match[1] as string;
        counts[token] = (counts[token] ?? 0) + 1;
    }
    return counts;
}

/** True when `body` paints the WhatsApp fill through any `background*` property. */
function paintsFill(body: string): boolean {
    return new RegExp(`background[a-z-]*\\s*:[^;]*var\\(\\s*${TOKEN_PREFIX}\\s*[,)]`).test(body);
}

/** True when `body` takes its `color` from `token`. */
function usesInk(body: string, token: string): boolean {
    return new RegExp(`(?<!-)color\\s*:\\s*var\\(\\s*${token}\\s*[,)]`).test(body);
}

describe('HOS-314 static guard — WhatsApp surfaces consume the channel tokens', () => {
    const files = collectFiles(WEB_SRC);
    const code = new Map(
        files.map((file) => [
            path.relative(WEB_SRC, file),
            stripComments(fs.readFileSync(file, 'utf-8'), path.extname(file))
        ])
    );

    it('scans a non-empty set of web source files', () => {
        expect(files.length).toBeGreaterThan(0);
    });

    describe('rule 1 — each enumerated surface pairs the fill with its ink', () => {
        it.each(
            SURFACES.map((surface) => [`${surface.file} ${surface.selector}`, surface] as const)
        )('%s', (_label, surface) => {
            const source = code.get(surface.file);
            expect(source, `${surface.file} is not in the scanned tree`).toBeDefined();

            const body = ruleBody(source ?? '', surface.selector);
            expect(
                body,
                `could not locate the rule ${surface.selector} in ${surface.file} — if it was renamed or restructured, update SURFACES; an unreadable rule is a failure, not a skip`
            ).not.toBeNull();

            expect(
                paintsFill(body ?? ''),
                `${surface.selector} no longer paints var(${TOKEN_PREFIX})`
            ).toBe(true);
            expect(
                usesInk(body ?? '', surface.ink),
                `${surface.selector} must ink from var(${surface.ink}) — ${surface.reason}`
            ).toBe(true);
        });

        it('no enumerated surface inks the brand green with a bare literal', () => {
            // A second `color` declaration in the same rule would win the cascade
            // over the token one, so "uses the ink token" is not sufficient on its
            // own. NOTE the lookahead swallows the whitespace: written as
            // `\s*:\s*(?!var\()` the `\s*` backtracks to zero and the assertion
            // passes on `color: var(…)` — it fired on all four correct rules
            // before this was fixed.
            const offenders = SURFACES.filter((surface) => {
                const body = ruleBody(code.get(surface.file) ?? '', surface.selector) ?? '';
                return /(?<!-)color\s*:(?!\s*var\()/.test(body);
            }).map((surface) => `${surface.file} ${surface.selector}`);

            expect(
                offenders,
                'a `color` that is not a var() on a rule painting the brand green — white on it is 1.98:1'
            ).toEqual([]);
        });
    });

    describe('rule 2 — closure: only the enumerated files may touch the tokens', () => {
        const allowedFiles = new Set(SURFACES.map((surface) => surface.file));

        it('no other file mentions --channel-whatsapp in any spelling', () => {
            // One substring scan covers every route the previous design had to
            // enumerate: alias indirection, [data-theme] overrides, TSX object
            // literals, define:vars, setProperty, and new surfaces.
            const offenders = [...code]
                .filter(
                    ([file, source]) => !allowedFiles.has(file) && source.includes(TOKEN_PREFIX)
                )
                .map(([file]) => file);

            expect(
                offenders,
                `files outside SURFACES referencing ${TOKEN_PREFIX} — add a SURFACES entry (with its ink) instead, so the pairing is reviewed`
            ).toEqual([]);
        });

        it('the enumerated files consume the tokens but never declare them', () => {
            // A declaration in app CSS outranks :root, so it can retheme the
            // brand ink without touching @repo/design-tokens. Matches the CSS,
            // Astro `style=`, and quoted TSX object-literal spellings.
            const offenders = [...allowedFiles]
                .filter((file) =>
                    new RegExp(
                        `${TOKEN_PREFIX}[a-z-]*["']?\\s*:|@property\\s+${TOKEN_PREFIX}`
                    ).test(code.get(file) ?? '')
                )
                .map((file) => file);

            expect(
                offenders,
                `${TOKEN_PREFIX}* is owned by @repo/design-tokens; declaring it here outranks :root and can take the button to 1.57:1`
            ).toEqual([]);
        });

        it('every enumerated file exists and is scanned (no stale entries)', () => {
            const stale = [...allowedFiles].filter((file) => !code.has(file));
            expect(stale, 'SURFACES entries pointing at files that no longer exist').toEqual([]);
        });

        it.each(
            Object.keys(EXPECTED_REFERENCES)
        )('%s references the channel tokens exactly as enumerated', (file) => {
            // Closes the door from INSIDE an allowed file: a new rule, a theme
            // override or a stray logo-ink reference all change these counts.
            expect(countTokenReferences(code.get(file) ?? '')).toEqual(EXPECTED_REFERENCES[file]);
        });

        it('the per-file reference map covers exactly the enumerated files', () => {
            expect(Object.keys(EXPECTED_REFERENCES).sort()).toEqual([...allowedFiles].sort());
        });
    });

    describe('rule 3 — no WhatsApp color spelled out as a literal', () => {
        for (const { label, pattern } of FORBIDDEN_LITERALS) {
            it(`no file hard-codes the ${label}`, () => {
                const offenders = [...code]
                    .filter(([, source]) => pattern.test(source))
                    .map(([file]) => file);

                expect(
                    offenders,
                    'files hard-coding a WhatsApp color instead of the token'
                ).toEqual([]);
            });
        }
    });

    describe('the comment stripper (the only text processing left, so it is tested)', () => {
        it('exempts a brand hex mentioned in a CSS block comment', () => {
            const css = '/* rejected: #128c7e is 3.57:1 */\n.a { color: var(--channel-whatsapp); }';
            expect(stripComments(css, '.css')).not.toContain('#128c7e');
        });

        it('exempts a brand hex in a TS or Astro line comment', () => {
            const ts = '// white on #25d366 is 1.98:1\nconst a = 1;';
            expect(stripComments(ts, '.ts')).not.toContain('#25d366');
            expect(stripComments(`---\n${ts}\n---`, '.astro')).not.toContain('#25d366');
        });

        it('keeps a real declaration that follows a comment', () => {
            const css = '/* HOS-314 */\n.a { background-color: #25d366; }';
            expect(stripComments(css, '.css')).toContain('#25d366');
        });

        it('does not treat a double slash inside a CSS value as a comment', () => {
            const url = '.a { background: url(//cdn.x/i.png) #25d366; }';
            const data = '.a { background: url(data:image/png;base64,iVBOR//w0K); color: #25d366 }';
            expect(stripComments(url, '.css')).toContain('#25d366');
            expect(stripComments(data, '.css')).toContain('#25d366');
        });

        it('does not let a line-comment marker inside a block comment blank the file', () => {
            const css = '/* see https://wa.me // note */\n.a { background-color: #25d366; }';
            expect(stripComments(css, '.css')).toContain('#25d366');
        });

        it('does not let a comment opener inside a STRING blank real code', () => {
            // The live case: pages/robots.txt.ts contains '/*/verify-email-sent',
            // which a quote-blind stripper reads as an unterminated block comment
            // and which blanked 429 characters of that file.
            const ts = "const paths = ['/*/verify-email-sent'];\nconst c = '#25d366';";
            const stripped = stripComments(ts, '.ts');
            expect(stripped).toContain('#25d366');
            expect(stripped).toContain('/*/verify-email-sent');
        });

        it('preserves every declaration of the real file that exposed that bug', () => {
            const robots = path.join(WEB_SRC, 'pages/robots.txt.ts');
            const raw = fs.readFileSync(robots, 'utf-8');
            const stripped = stripComments(raw, '.ts');
            // Pinned against the real file so a future rewrite of the stripper
            // cannot silently start blanking it again.
            expect(stripped).toContain("'/*/verify-email-sent'");
            expect(stripped).toContain('SITEMAP_EXCLUDED_PATHS');
        });
    });

    describe('rule location (fails closed, never silently empty)', () => {
        it('returns the rule body including any nested block', () => {
            const css =
                '.cta { background-color: var(--channel-whatsapp); color: white; @media (min-width: 900px) { letter-spacing: 0.01em; } }';
            const body = ruleBody(css, '.cta');
            expect(body).not.toBeNull();
            expect(paintsFill(body ?? '')).toBe(true);
            expect(usesInk(body ?? '', INK_AA)).toBe(false);
        });

        it('returns null — not an empty body — when the selector is absent', () => {
            expect(ruleBody('.other { color: red; }', '.cta')).toBeNull();
        });

        it('does not match a pseudo-class or descendant variant of the selector', () => {
            expect(ruleBody('.cta:hover { color: red; }', '.cta')).toBeNull();
            expect(ruleBody('.wrap .cta { color: red; }', '.cta')).toBeNull();
        });

        it('sees the fill in a gradient or a background shorthand', () => {
            const gradient =
                '.a { background-image: linear-gradient(var(--channel-whatsapp), var(--channel-whatsapp-hover)); }';
            const shorthand = '.b { background: no-repeat var(--channel-whatsapp); }';
            expect(paintsFill(ruleBody(gradient, '.a') ?? '')).toBe(true);
            expect(paintsFill(ruleBody(shorthand, '.b') ?? '')).toBe(true);
        });

        it('does not confuse a --*-color custom property with the color property', () => {
            const css = '.a { --x-color: var(--channel-whatsapp-foreground); }';
            expect(usesInk(ruleBody(css, '.a') ?? '', INK_AA)).toBe(false);
        });
    });
});
