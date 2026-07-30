/**
 * @file ink-literals.ts
 * @description Shared assertion helper for HOS-314 — finds text-color
 * declarations that are NOT design tokens.
 *
 * WHY IT EXISTS AND WHY IT IS SHARED. The WhatsApp CTA shipped `color: white` on
 * the brand green: 1.98:1, failing WCAG AA for both normal and large text. The
 * obvious way to prevent that recurrence is to check, per rule, that a rule
 * painting the green inks its text from the AA-safe token — and three revisions
 * of the static guard tried exactly that, and three rounds of adversarial review
 * defeated all three, because deciding which `color` declaration actually paints
 * a given element means resolving the CSS cascade. A duplicate selector, a
 * descendant, an `:is()`, a `@media` re-declaration, a child rule or
 * `-webkit-text-fill-color` each override the ink from somewhere a
 * selector-anchored regex never looks.
 *
 * This helper sidesteps the cascade entirely by asking a WHOLE-FILE question
 * instead of a per-rule one: in a component that paints the WhatsApp green,
 * EVERY text-color declaration must be a `var()`. Position stops mattering, so
 * duplicates and media queries and descendants are all covered at once, and so
 * is every spelling of white — `white`, `#fff`, `#ffffff`, `#fefefe`,
 * `rgb(255 255 255)`, `hsl(0 0% 100%)`, `WhiteSmoke` — because the rule is not
 * "no white", it is "nothing but tokens".
 *
 * It is shared rather than copied into the three component tests on purpose: the
 * whole point is that the three WhatsApp surfaces cannot diverge, and three
 * copies of an invariant are three chances for one to drift. That is the same
 * mistake this issue started from.
 *
 * @module test/static-guards/ink-literals
 */

/**
 * Matches a TEXT color declaration and captures its value.
 *
 * `[^\w-]` before the property name excludes `background-color`, `border-color`,
 * `caret-color` and friends — those are not the ink — while still matching
 * `-webkit-text-fill-color`, which DOES paint text and beats `color` when both
 * are set. The value runs to the next `;` or `}`.
 */
const TEXT_COLOR_DECLARATION = /(?:^|[^\w-])(-webkit-text-fill-color|color)\s*:\s*([^;}]+)/g;

/** A declaration whose value is not a `var()` reference. */
export type BareInkDeclaration = {
    /** The property that was set (`color` or `-webkit-text-fill-color`). */
    readonly property: string;
    /** The literal value, trimmed. */
    readonly value: string;
};

/**
 * Returns every text-color declaration in `source` whose value is not a `var()`.
 *
 * Comments must already be stripped by the caller if prose is to be exempt; the
 * component tests pass raw source, since none of the three files mentions a color
 * literal in prose.
 *
 * @param source - File contents to inspect (`.astro`, `.css`, `.tsx`).
 * @returns The offending declarations, empty when every ink comes from a token.
 */
export function findBareInkDeclarations(source: string): BareInkDeclaration[] {
    const offenders: BareInkDeclaration[] = [];

    for (const match of source.matchAll(TEXT_COLOR_DECLARATION)) {
        const property = match[1] as string;
        const value = (match[2] as string).trim();
        // `currentColor` inherits whatever the (token-derived) parent ink is, so it
        // introduces no literal of its own — and it is how the inline SVGs pick up
        // the button's ink.
        if (value.startsWith('var(') || value.toLowerCase() === 'currentcolor') {
            continue;
        }
        offenders.push({ property, value });
    }

    return offenders;
}
