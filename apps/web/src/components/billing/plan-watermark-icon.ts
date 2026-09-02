/**
 * @file plan-watermark-icon.ts
 * @description The oversized, heavily-faded glyph each pricing card carries in
 * its top-right corner, clipped by the card's own `overflow`.
 *
 * ## Why a table and not a field on the plan
 *
 * The glyph is presentation, not catalogue data: an operator re-pricing a tier
 * in admin must not have to pick an icon, and the API deliberately returns no
 * such field. So the mapping lives in the web app, keyed by the plan SLUG — the
 * one stable identifier the public endpoint exposes.
 *
 * ## The fallback is the whole point
 *
 * A slug that is not in the table gets {@link PLAN_WATERMARK_FALLBACK_ICON}, not
 * `undefined`. The catalogue is editable from admin, so a tier this file has
 * never heard of is an ORDINARY event, not an error: `commerce`-domain plans and
 * anything an operator adds tomorrow all land here. Returning `undefined` would
 * make the card render `<undefined />` — an Astro build error on a page that is
 * otherwise fine — which is a far worse outcome than a generic sparkle.
 *
 * ## The progression is what carries the meaning
 *
 * Within an audience the glyphs read as a ladder rather than as five unrelated
 * pictures: one house → several buildings → a crown for the owner tiers, a
 * compass → a star for the tourist ones. Which specific glyph sits on a given
 * tier matters much less than that the sequence goes somewhere.
 */

import type { IconProps } from '@repo/icons';
import {
    BuildingsIcon,
    CompassIcon,
    CrownIcon,
    HomeIcon,
    SparkleIcon,
    StarIcon
} from '@repo/icons';
import type { ComponentType } from 'react';

/** What an unknown plan slug gets. Deliberately generic and audience-neutral. */
export const PLAN_WATERMARK_FALLBACK_ICON: ComponentType<IconProps> = SparkleIcon;

/** Glyph per plan slug. Anything absent resolves to the fallback. */
export const PLAN_WATERMARK_ICONS: Readonly<Record<string, ComponentType<IconProps>>> = {
    'owner-basico': HomeIcon,
    'owner-pro': BuildingsIcon,
    'owner-premium': CrownIcon,
    'tourist-free': CompassIcon,
    'tourist-vip': StarIcon
} as const;

/**
 * The watermark glyph for one plan.
 *
 * Total: every slug resolves to a component, so the card can render it
 * unconditionally and no tier can be the one that breaks the page.
 *
 * @param input - Wrapper object.
 * @param input.slug - The plan's slug, as returned by `GET /public/plans`.
 * @returns The mapped glyph, or {@link PLAN_WATERMARK_FALLBACK_ICON}.
 *
 * @example
 * ```ts
 * resolvePlanWatermarkIcon({ slug: 'owner-premium' }); // CrownIcon
 * resolvePlanWatermarkIcon({ slug: 'whatever-2027' }); // SparkleIcon
 * ```
 */
export function resolvePlanWatermarkIcon(input: {
    readonly slug: string;
}): ComponentType<IconProps> {
    return PLAN_WATERMARK_ICONS[input.slug] ?? PLAN_WATERMARK_FALLBACK_ICON;
}
