/**
 * Dashboard accent + icon system — SPEC-155 redesign.
 *
 * Two config-driven concerns:
 * 1. ACCENTS — maps a palette NAME to the CSS variable references used to tint
 *    a card (icon chip background, icon/emphasis foreground, chart solid).
 *    Every value resolves to a `--palette-<name>-<shade>` primitive emitted by
 *    `@repo/design-tokens` (SPEC-153) — nothing is hardcoded.
 * 2. ICONS — a small curated map of `@repo/icons` components keyed by a short
 *    semantic name. The global `resolveIcon`/`ICON_MAP` only covers amenity /
 *    feature icons, so dashboard chrome icons are imported directly here.
 *
 * The per-card accent + icon stay config-driven (each widget sets
 * `config.accent` / `config.icon`).
 *
 * Light-only by design (the admin panel dropped `dark:` in the SPEC-153
 * follow-up); fixed shades (100 chip / 600 fg / 500 solid) read well on the
 * warm off-white card surface.
 *
 * @module dashboards/dashboard-accents
 */

import {
    ActivityIcon,
    BarChartIcon,
    BuildingsIcon,
    CalendarIcon,
    ChatIcon,
    ClockIcon,
    CompassIcon,
    CreditCardIcon,
    FileTextIcon,
    ShieldIcon,
    StarIcon,
    UserIcon,
    UsersIcon
} from '@repo/icons';
import type { IconProps } from '@repo/icons';
import type { ComponentType } from 'react';

/**
 * Curated dashboard icon map (short semantic name → `@repo/icons` component).
 * Keep names generic so cards reference intent, not a specific glyph.
 */
export const DASHBOARD_ICONS = {
    buildings: BuildingsIcon,
    compass: CompassIcon,
    calendar: CalendarIcon,
    article: FileTextIcon,
    star: StarIcon,
    user: UserIcon,
    users: UsersIcon,
    clock: ClockIcon,
    activity: ActivityIcon,
    shield: ShieldIcon,
    billing: CreditCardIcon,
    chart: BarChartIcon,
    chat: ChatIcon
} as const satisfies Record<string, ComponentType<IconProps>>;

/** Valid dashboard icon names (keys of {@link DASHBOARD_ICONS}). */
export type DashboardIconName = keyof typeof DASHBOARD_ICONS;

/**
 * Resolves a dashboard icon name to its component, or `undefined` when the name
 * is missing/unknown (the card then renders without a chip — no crash).
 *
 * @param name - Icon name from `widget.config.icon`.
 */
export function resolveDashboardIcon(
    name: string | undefined
): ComponentType<IconProps> | undefined {
    if (!name) return undefined;
    return DASHBOARD_ICONS[name as DashboardIconName];
}

/**
 * Accent palette names available to dashboard cards. A subset of the
 * `@repo/design-tokens` palettes chosen for visual distinctiveness.
 */
export type AccentPalette =
    | 'river'
    | 'sky'
    | 'forest'
    | 'sand'
    | 'accent'
    | 'teal'
    | 'cyan'
    | 'terracotta'
    | 'rose'
    | 'purple'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info';

/** CSS-variable references for one accent palette. */
export interface AccentVars {
    /** Soft tinted background for the icon chip (shade 100). */
    readonly chip: string;
    /** Strong accent for the chip icon / emphasis (shade 600). */
    readonly fg: string;
    /** Mid solid for charts / sparklines (shade 500). */
    readonly solid: string;
}

/** Default accent when a card omits `config.accent` or passes an unknown name. */
const FALLBACK_PALETTE: AccentPalette = 'river';

const VALID_PALETTES: ReadonlySet<string> = new Set<AccentPalette>([
    'river',
    'sky',
    'forest',
    'sand',
    'accent',
    'teal',
    'cyan',
    'terracotta',
    'rose',
    'purple',
    'success',
    'warning',
    'danger',
    'info'
]);

/**
 * Resolves an accent palette name to its CSS-variable references.
 *
 * Falls back to {@link FALLBACK_PALETTE} when the name is missing or not a
 * known palette, so a config typo degrades to the brand river accent instead
 * of emitting an invalid `var()`.
 *
 * @param palette - Palette name from `widget.config.accent` (may be undefined).
 * @returns The chip / fg / solid CSS-variable strings for inline styling.
 *
 * @example
 * ```tsx
 * const a = accentVars('forest');
 * <span style={{ backgroundColor: a.chip }}><Icon color={a.fg} /></span>
 * ```
 */
export function accentVars(palette: string | undefined): AccentVars {
    const name = palette && VALID_PALETTES.has(palette) ? palette : FALLBACK_PALETTE;
    return {
        chip: `var(--palette-${name}-100)`,
        fg: `var(--palette-${name}-600)`,
        solid: `var(--palette-${name}-500)`
    };
}
