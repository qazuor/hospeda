/**
 * @file ink-literals.ts
 * @description Shared predicate for HOS-314 — finds text ink that does NOT come
 * from an approved design token.
 *
 * WHY IT EXISTS. The WhatsApp CTA shipped `color: white` on the brand green:
 * 1.98:1, failing WCAG AA for both normal and large text. The obvious way to
 * prevent a recurrence is to check, per rule, that a rule painting the green inks
 * its text from the AA-safe token — and three revisions of the static guard tried
 * exactly that, and three rounds of adversarial review defeated all three,
 * because deciding which declaration actually paints an element means resolving
 * the CSS cascade. A duplicate selector, a descendant, an `:is()`, a `@media`
 * re-declaration, a child rule or `-webkit-text-fill-color` each override the ink
 * from somewhere a selector-anchored regex never looks.
 *
 * So this asks a WHOLE-FILE question instead of a per-rule one, which makes
 * position irrelevant: in a component that paints the WhatsApp green, every ink
 * must resolve to a token on `APPROVED_INK_TOKENS`.
 *
 * WHY AN ALLOWLIST RATHER THAN "MUST BE A `var()`". The revision before this one
 * accepted any value starting with `var(`, and round 4 showed that is a laundering
 * primitive, not an exemption. All three of these satisfied it while painting
 * white on the green:
 *   - `var(--wa-ink, #fff)` — a fallback fires precisely when the property is
 *     undefined, which is the failure mode being guarded;
 *   - `var(--surface-overlay)` — a LIVE repo token whose light value is
 *     `oklch(1 0 0)`, i.e. pure white. No invented name needed;
 *   - `--ink: white; -webkit-text-fill-color: var(--ink)` — one hop through a
 *     local custom property, which is ordinary CSS-module authoring.
 * Enumerating the tokens that may serve as ink closes all three at once: a
 * fallback is rejected outright, and an unlisted token name — local or global —
 * is rejected whatever its value happens to be.
 *
 * It is shared rather than copied into the three component tests on purpose: the
 * whole point is that the three WhatsApp surfaces cannot diverge, and three copies
 * of an invariant are three chances for one to drift. That is the mistake this
 * issue started from.
 *
 * WHAT IT DOES NOT SEE, so a green run is not mistaken for more:
 *   - A cross-file `!important` ink override (e.g. in `styles/global.css`)
 *     targeting these components' classes. Astro's scoping attribute out-
 *     specifies a bare class selector, so only `!important` reaches; none exists
 *     today.
 *   - `all: unset|revert`, `filter: invert()` and `opacity`, which recolor without
 *     naming a color property. None present in the three files.
 *   - Ink set from JavaScript at runtime.
 *
 * @module test/static-guards/ink-literals
 */

/**
 * The only tokens that may paint text in a file that also paints the WhatsApp
 * brand green. Derived from the three components' current declarations — this is
 * an enumeration, so adding a token here is the review conversation.
 */
export const APPROVED_INK_TOKENS: readonly string[] = [
    // The channel inks. `-foreground` is the AA-safe ink on the green (9.12:1),
    // `-logo` is white and valid ONLY for the logotype badge (WCAG 1.4.3),
    // `-text` is the theme-aware teal for the number on `--surface-warm`.
    '--channel-whatsapp-foreground',
    '--channel-whatsapp-logo',
    '--channel-whatsapp-text',
    // System inks used by the surrounding block copy.
    '--core-foreground',
    '--core-muted-foreground',
    '--primary-foreground',
    '--surface-warm-foreground'
];

/**
 * Matches a TEXT ink declaration and captures its value.
 *
 * `[^\w-]` before the property name excludes `background-color`, `border-color`,
 * `caret-color` and friends — those are not the ink — while still matching
 * `-webkit-text-fill-color`, which DOES paint text and beats `color` when both are
 * set. The `i` flag is load-bearing: CSS property names are ASCII
 * case-insensitive, so `COLOR: #fff` paints, and the narrower assertion this
 * helper replaced carried `/i` while its first version did not.
 */
const INK_DECLARATION = /(?:^|[^\w-])(-webkit-text-fill-color|color)\s*:\s*([^;}\n]+)/gi;

/** Matches an SVG `fill`/`stroke` attribute, which inks an inline glyph. */
const GLYPH_ATTRIBUTE = /\b(fill|stroke)="([^"]*)"/gi;

/** A `var()` reference with no fallback: `var(--token)` and nothing else. */
const BARE_TOKEN_REFERENCE = /^var\(\s*(--[a-z0-9-]+)\s*\)$/i;

/** Comment prose, stripped so a rationale mentioning a color cannot false-positive. */
function stripLeadingComments(source: string): string {
    return source.replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, '').replace(/^[ \t]*\/\/[^\n]*/gm, '');
}

/** An ink declaration whose value is not an approved token. */
export type UnapprovedInk = {
    /** The property or attribute that was set, lowercased. */
    readonly property: string;
    /** The offending value, trimmed. */
    readonly value: string;
    /** Why it was rejected — surfaces in the assertion diff. */
    readonly reason: string;
};

/**
 * Returns every ink declaration in `source` that does not resolve to a token on
 * {@link APPROVED_INK_TOKENS}.
 *
 * `currentColor` is accepted: it inherits the computed ink, so it introduces no
 * literal of its own, and it is how the inline SVGs pick up the button's ink.
 * `inherit` is NOT accepted — on a green fill it would resolve to the section's
 * ink, which inverts to near-white in dark mode (1.56:1).
 *
 * @param source - File contents to inspect (`.astro`, `.css`, `.tsx`).
 * @returns The offending declarations, empty when every ink comes from an approved token.
 */
export function findBareInkDeclarations(source: string): UnapprovedInk[] {
    const code = stripLeadingComments(source);
    const offenders: UnapprovedInk[] = [];

    const inspect = (property: string, rawValue: string): void => {
        // `!important` does not change which color is painted, so it is stripped
        // before the comparison rather than allowed to defeat it.
        const value = rawValue.replace(/\s*!important\s*$/i, '').trim();

        if (value.toLowerCase() === 'currentcolor' || value.toLowerCase() === 'none') {
            return;
        }

        const reference = BARE_TOKEN_REFERENCE.exec(value);
        if (!reference) {
            offenders.push({
                property,
                value,
                reason: value.toLowerCase().startsWith('var(')
                    ? 'var() with a fallback — the fallback paints when the token is undefined'
                    : 'not a token reference'
            });
            return;
        }

        const token = (reference[1] as string).toLowerCase();
        if (!APPROVED_INK_TOKENS.includes(token)) {
            offenders.push({
                property,
                value,
                reason: `${token} is not on APPROVED_INK_TOKENS — a token may hold any color, including white`
            });
        }
    };

    for (const match of code.matchAll(INK_DECLARATION)) {
        inspect((match[1] as string).toLowerCase(), match[2] as string);
    }
    for (const match of code.matchAll(GLYPH_ATTRIBUTE)) {
        inspect((match[1] as string).toLowerCase(), match[2] as string);
    }

    return offenders;
}
