/**
 * @file billing/audience-card-content.ts
 * @description What each audience card on `/suscriptores/planes/` SAYS and how
 * it is marked, as opposed to where it links and what it costs (that is
 * `audience-plans.ts`).
 *
 * HOS-942 shipped the index as five bordered links: a title, one interchangeable
 * line and a "from $X". The owner read it back as a list of links rather than as
 * a product, which it was — nothing on a card told a restaurant owner they were
 * being offered something different from what a host is offered. This module
 * owns the two things that fix that, and it lives outside the `.astro` file for
 * the reason `pricing-card-view.ts` documents at length: Vitest cannot render an
 * Astro component, so anything left in a template can only ever be asserted by
 * reading its source text — which cannot tell a correct highlight list from an
 * empty one.
 *
 * ## 1. Three concrete highlights per audience
 *
 * Every line is audience-specific and describes something the vertical actually
 * has: the host bullets come from the owner plans' entitlements (publishing,
 * WhatsApp contact, review replies, stats, promotions), the two commerce ones
 * restate the benefit blocks the vertical's own landing already publishes, and
 * the partner ones restate `alliance-leads.partner.benefits.*`. No bullet
 * mentions a trial length or a payment method — those are the pricing pages'
 * job, and a number written here would go stale the moment an operator edits the
 * catalogue.
 *
 * The partner bullets deliberately never name a TIER. The tier is what decides
 * whether a partner gets its own page (HOS-294), but it is never rendered
 * publicly, so a bullet that said "gold" would leak vocabulary the product does
 * not use in front of a visitor.
 *
 * ## 2. One glyph per audience
 *
 * The five cards have to be told apart at a glance, which they cannot be when
 * the ONLY difference between them is a paragraph. The glyph is the primary
 * non-textual mark; the per-audience accent colour in the page's stylesheet is
 * keyed off the same `data-audience` attribute and reinforces it. Both come from
 * material the site already ships — `@repo/icons` and existing design tokens —
 * because there are no illustrations to draw on.
 */

import type { IconProps } from '@repo/icons';
import { CompassIcon, ForkKnifeIcon, HomeIcon, MegaphoneIcon, StarIcon } from '@repo/icons';
import type { ComponentType } from 'react';
import type { AudienceCardId } from '@/lib/billing/audience-plans';
import type { TranslationFn } from '@/lib/i18n';

/**
 * How many highlights a card shows.
 *
 * Three, uniformly: a card with five bullets and one beside it with two stop
 * being comparable, and the grid's rows would jump. It is a constant rather than
 * a literal because the locale keys and the tests both count off it.
 */
export const AUDIENCE_HIGHLIGHT_COUNT = 3;

/** The glyph that marks each audience. */
export const AUDIENCE_CARD_ICONS: Readonly<Record<AudienceCardId, ComponentType<IconProps>>> = {
    host: HomeIcon,
    tourist: StarIcon,
    gastronomy: ForkKnifeIcon,
    experience: CompassIcon,
    partner: MegaphoneIcon
} as const;

/**
 * The locale keys holding one audience's highlights, in display order.
 *
 * @param input - Wrapper object.
 * @param input.id - The audience.
 * @returns `AUDIENCE_HIGHLIGHT_COUNT` dot-notation keys.
 *
 * @example
 * ```ts
 * audienceHighlightKeys({ id: 'host' });
 * // ['pricing.index.cards.host.highlights.item1', …]
 * ```
 */
export function audienceHighlightKeys(input: { readonly id: AudienceCardId }): readonly string[] {
    const { id } = input;
    return Array.from(
        { length: AUDIENCE_HIGHLIGHT_COUNT },
        (_unused, index) => `pricing.index.cards.${id}.highlights.item${index + 1}`
    );
}

/**
 * Resolve one audience's highlights, dropping anything that did not translate.
 *
 * `resolve()` in `@/lib/i18n` returns the raw dotted key when a key is absent
 * (and `[MISSING: key]` in dev), so a locale file that lost a bullet would print
 * `pricing.index.cards.host.highlights.item3` inside the card instead of failing
 * anywhere. Dropping the line degrades that to a shorter list, which is the only
 * one of the two outcomes a visitor can make sense of.
 *
 * The check is on the RESOLVED value against the key that produced it — not a
 * blanket "contains a dot" test, which would also delete a legitimately
 * translated sentence that happens to end in a full stop. Every one of these
 * bullets does.
 *
 * @param input - Wrapper object.
 * @param input.id - The audience.
 * @param input.t - Translation function for the request's locale.
 * @returns The bullets that resolved, in order; possibly empty.
 *
 * @example
 * ```ts
 * resolveAudienceHighlights({ id: 'partner', t });
 * // ['Presencia de marca en el carrusel de aliados de Hospeda.', …]
 * ```
 */
export function resolveAudienceHighlights(input: {
    readonly id: AudienceCardId;
    readonly t: TranslationFn;
}): readonly string[] {
    const { id, t } = input;
    const resolved: string[] = [];
    for (const key of audienceHighlightKeys({ id })) {
        const value = t(key);
        if (value === key) continue;
        if (value === `[MISSING: ${key}]`) continue;
        if (value.trim().length === 0) continue;
        resolved.push(value);
    }
    return resolved;
}
