/**
 * The three verticals a visitor can publish in, and the cap that governs each
 * (HOS-1156 D-7).
 *
 * ---
 * WHY THIS FILE EXISTS, AND WHY IT IS NOT `commerce-limits.config.ts`
 *
 * `/publicar/` asks one question the commerce file structurally cannot answer:
 * *including accommodation*, which `LimitKey` caps this vertical? The publish
 * precheck is one parameterised route across all three verticals, so it needs
 * one total function over all three — and `CommerceVertical` is, correctly, only
 * two of them. Widening that type to admit `'accommodation'` would have been the
 * wrong repair: `commerceVerticalToProductDomain`, the AI-chat map and the
 * entitlement middleware all depend on it meaning *commerce*, and HOS-1079 exists
 * precisely because a binary ternary silently answered `'experience'` for
 * `'accommodation'`.
 *
 * So the union widens here, in its own module, and the commerce one stays exactly
 * as narrow as it was.
 * ---
 *
 * ## The map inherits; it does not restate
 *
 * {@link LIMIT_KEY_BY_PUBLISH_VERTICAL} spreads
 * {@link LIMIT_KEY_BY_COMMERCE_VERTICAL} rather than re-listing
 * `gastronomy: MAX_GASTRONOMIES` and `experience: MAX_EXPERIENCES`. That is the
 * same discipline `commerceVerticalToProductDomain` follows one file over: a
 * second copy of a fact is a second place for it to drift, and the drift is
 * invisible because both copies type-check. Only accommodation — the one
 * association that exists nowhere else — is written literally.
 *
 * Consequence worth stating: a fourth commerce vertical added to
 * `LIMIT_KEY_BY_COMMERCE_VERTICAL` arrives here automatically and correctly. A
 * fourth NON-commerce publish vertical is a compile error here, which is what it
 * should be — an unresolved limit key reads as UNLIMITED at every layer beneath.
 *
 * @module config/publish-verticals
 */

import { LimitKey } from '../types/plan.types.js';
import { type CommerceVertical, LIMIT_KEY_BY_COMMERCE_VERTICAL } from './commerce-limits.config.js';

/**
 * The verticals reachable from the header's "Publicar" menu: the two commerce
 * ones plus accommodation.
 *
 * Spelled the way the URL segments and the API path param spell them, so the
 * value that arrives from a request needs narrowing but never translation.
 */
export type PublishVertical = 'accommodation' | CommerceVertical;

/**
 * Every publish vertical's listing cap.
 *
 * Exhaustive over {@link PublishVertical} by type. See the module doc for why the
 * commerce half is spread rather than re-listed.
 */
export const LIMIT_KEY_BY_PUBLISH_VERTICAL: Readonly<Record<PublishVertical, LimitKey>> = {
    accommodation: LimitKey.MAX_ACCOMMODATIONS,
    ...LIMIT_KEY_BY_COMMERCE_VERTICAL
} as const;

/**
 * Whether a publish vertical is one of the commerce ones.
 *
 * Exists so callers stop writing `v !== 'accommodation'` and inheriting the
 * "anything that is not X is Y" shape HOS-1079 removed from five call sites. It
 * narrows, so the `true` branch may be handed to any function taking a
 * {@link CommerceVertical} — including `commerceVerticalToProductDomain`.
 *
 * @param vertical - The publish vertical to test.
 * @returns `true` when the vertical is `'gastronomy'` or `'experience'`.
 *
 * @example
 * ```ts
 * if (isCommercePublishVertical(vertical)) {
 *     // `vertical` is a CommerceVertical here
 *     const domain = commerceVerticalToProductDomain(vertical);
 * }
 * ```
 */
export function isCommercePublishVertical(vertical: PublishVertical): vertical is CommerceVertical {
    return Object.hasOwn(LIMIT_KEY_BY_COMMERCE_VERTICAL, vertical);
}

/**
 * Narrows an unchecked string to a {@link PublishVertical}, throwing for anything
 * else.
 *
 * The publish precheck takes its vertical from a URL path param, which is an
 * unchecked `string` at the boundary. Mirrors `parseCommerceVertical` in the
 * commerce module — same guard, wider union — rather than letting a route hand a
 * raw string to {@link LIMIT_KEY_BY_PUBLISH_VERTICAL} and index it to
 * `undefined`, which every layer beneath would read as "no cap".
 *
 * Uses `Object.hasOwn`, never the `in` operator: `in` walks the prototype chain,
 * so `'toString'`, `'constructor'` and `'__proto__'` would all pass a membership
 * test written that way — and the value arriving here comes from a URL.
 *
 * @param value - The unchecked value to narrow.
 * @param context - A short label identifying the caller, folded into the thrown
 *   error so a failure is traceable back to its call site.
 * @returns `value`, narrowed to {@link PublishVertical}.
 * @throws {Error} When `value` is not a publish vertical.
 */
export function parsePublishVertical(value: string, context: string): PublishVertical {
    if (Object.hasOwn(LIMIT_KEY_BY_PUBLISH_VERTICAL, value)) {
        return value as PublishVertical;
    }
    throw new Error(`${context}: unsupported publish vertical '${value}'`);
}
