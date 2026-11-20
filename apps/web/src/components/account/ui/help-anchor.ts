/**
 * Help anchors for the Mi Cuenta kit (HOS-2413 T-003, HOS-2410 convention).
 *
 * A help anchor names the help-center article (and optionally the element
 * inside it) that explains a piece of the account UI. Kit components render it
 * as a `data-help` attribute on their root. `Section` requires one; every
 * other kit component takes it as an optional `helpId`.
 *
 * Grammar (lowercase kebab segments):
 *
 *   section:<vertical>.<slug>
 *   section:<vertical>.<slug>#<element>
 *
 * e.g. `section:venue.carta` or `section:venue.carta#save-disabled`.
 *
 * The kit validates the SHAPE only. Whether an anchor resolves to a real
 * article is HOS-2410's guard. When `packages/help` lands, `HelpAnchor` is
 * re-exported from there and this local type is deleted.
 *
 * @module components/account/ui/help-anchor
 */

/** A help-center anchor rendered as `data-help` on a kit component root. */
export type HelpAnchor = `section:${string}.${string}` | `section:${string}.${string}#${string}`;

/** One lowercase kebab segment: `carta`, `save-disabled`, `host-trade`. */
const SEGMENT = '[a-z0-9]+(?:-[a-z0-9]+)*';

/** The full anchor grammar. */
const HELP_ANCHOR_PATTERN = new RegExp(`^section:${SEGMENT}\\.${SEGMENT}(?:#${SEGMENT})?$`);

/**
 * Tells whether a value is a well-formed help anchor.
 *
 * @param input - Options object.
 * @param input.value - The candidate value.
 * @returns `true` when `value` follows the anchor grammar.
 */
export function isHelpAnchor({ value }: { readonly value: unknown }): value is HelpAnchor {
    return typeof value === 'string' && HELP_ANCHOR_PATTERN.test(value);
}

/** The attribute object `helpAttr` returns, ready to spread on a root element. */
export type HelpAttr = { readonly 'data-help'?: HelpAnchor };

/**
 * Builds the `data-help` attribute for a kit component root.
 *
 * Returns `{}` when there is no `helpId`, so a spread never renders
 * `data-help="undefined"`.
 *
 * @param input - Options object.
 * @param input.helpId - The component's help anchor, if any.
 * @returns `{ 'data-help': helpId }`, or `{}` without one.
 *
 * @example
 * ```tsx
 * <section {...helpAttr({ helpId })}>…</section>
 * ```
 */
export function helpAttr({ helpId }: { readonly helpId?: HelpAnchor }): HelpAttr {
    return helpId === undefined ? {} : { 'data-help': helpId };
}
