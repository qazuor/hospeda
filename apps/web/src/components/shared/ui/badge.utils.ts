/**
 * @file badge.utils.ts
 * @description Pure helper functions for computing Badge styles and class names.
 * Used by both the Astro (`Badge.astro`) and React (`Badge.tsx`) implementations
 * to guarantee visually identical output.
 *
 * All functions are pure, side-effect-free, and follow the RO-RO pattern
 * (Receive Object, Return Object / primitive).
 */

import type { CSSProperties } from 'react';
import type { BadgeColorScheme, BadgeSize, BadgeVariant } from './badge.types';

/**
 * Returns CSS padding shorthand appropriate for the given badge size.
 *
 * @param params - Object containing the desired size.
 * @returns Padding value (e.g. `'2px 8px'`).
 */
export function getBadgePadding({ size }: { readonly size: BadgeSize }): string {
    switch (size) {
        case 'xs':
            return '0 6px';
        case 'sm':
            return '2px 8px';
        case 'md':
            return '4px 12px';
    }
}

/**
 * Returns icon pixel size to pair with the given badge size.
 *
 * @param params - Object containing the desired badge size.
 * @returns Icon size in pixels (12 / 14 / 16).
 */
export function getBadgeIconSize({ size }: { readonly size: BadgeSize }): number {
    switch (size) {
        case 'xs':
            return 12;
        case 'sm':
            return 14;
        case 'md':
            return 16;
    }
}

/**
 * Returns the font-size CSS value for the given badge size.
 *
 * @param params - Object containing the desired badge size.
 * @returns Font-size value in rem units.
 */
export function getBadgeFontSize({ size }: { readonly size: BadgeSize }): string {
    switch (size) {
        case 'xs':
            return '0.6875rem';
        case 'sm':
            return '0.75rem';
        case 'md':
            return '0.875rem';
    }
}

/**
 * Returns the min-height for the badge.
 *
 * Interactive (clickable) badges must meet the 44px tap-target guideline for
 * `sm`/`md` sizes. The `xs` size intentionally uses a smaller 24px min-height
 * suitable for chip-style filter lists. Decorative (non-clickable) badges
 * always use `auto` so they hug their content.
 *
 * @param params - Object with the size and whether the badge has an href.
 * @returns CSS min-height value (`'auto'` or pixel value).
 */
export function getBadgeMinHeight({
    size,
    hasHref
}: {
    readonly size: BadgeSize;
    readonly hasHref: boolean;
}): string {
    if (!hasHref) return 'auto';
    switch (size) {
        case 'xs':
            return '24px';
        case 'sm':
            return '44px';
        case 'md':
            return '44px';
    }
}

/** Internal helper: computes the variant-specific bg/color/border declarations. */
function getVariantColors({
    variant,
    colorScheme
}: {
    readonly variant: BadgeVariant;
    readonly colorScheme: BadgeColorScheme;
}): { readonly bg: string; readonly color: string; readonly border: string } {
    switch (variant) {
        case 'default':
            return {
                bg: colorScheme.bg,
                color: colorScheme.text,
                border: `1px solid ${colorScheme.border}`
            };
        case 'filled-dark':
            return {
                bg: 'var(--core-foreground)',
                color: 'var(--core-background)',
                border: 'none'
            };
        case 'outline':
            return {
                bg: 'transparent',
                color: colorScheme.text,
                border: `1px solid ${colorScheme.border}`
            };
        case 'dot':
            return {
                bg: 'var(--core-muted-foreground-a08)',
                color: 'var(--core-foreground)',
                border: '1px solid var(--core-muted-foreground-a15)'
            };
    }
}

/**
 * Builds an inline style string (suitable for Astro's `style` attribute)
 * composing padding, font-size, min-height, and variant-specific colors.
 *
 * @param params - Object with variant, color scheme, size, and href flag.
 * @returns CSS declarations as a single string.
 */
export function buildBadgeInlineStyle({
    variant,
    colorScheme,
    size,
    hasHref
}: {
    readonly variant: BadgeVariant;
    readonly colorScheme: BadgeColorScheme;
    readonly size: BadgeSize;
    readonly hasHref: boolean;
}): string {
    const { bg, color, border } = getVariantColors({ variant, colorScheme });
    const padding = getBadgePadding({ size });
    const fontSize = getBadgeFontSize({ size });
    const minHeight = getBadgeMinHeight({ size, hasHref });
    return `background-color: ${bg}; color: ${color}; border: ${border}; padding: ${padding}; font-size: ${fontSize}; min-height: ${minHeight};`;
}

/**
 * Builds the equivalent React `CSSProperties` object for the Badge.
 * Produces visually identical output to {@link buildBadgeInlineStyle}.
 *
 * @param params - Object with variant, color scheme, size, and href flag.
 * @returns React-compatible style object.
 */
export function buildBadgeStyleObject({
    variant,
    colorScheme,
    size,
    hasHref
}: {
    readonly variant: BadgeVariant;
    readonly colorScheme: BadgeColorScheme;
    readonly size: BadgeSize;
    readonly hasHref: boolean;
}): CSSProperties {
    const { bg, color, border } = getVariantColors({ variant, colorScheme });
    return {
        backgroundColor: bg,
        color,
        border,
        padding: getBadgePadding({ size }),
        fontSize: getBadgeFontSize({ size }),
        minHeight: getBadgeMinHeight({ size, hasHref })
    };
}

/**
 * Builds a space-joined class string for the Astro component.
 * Includes base `badge`, size/variant modifiers, interactive flag, and any
 * caller-provided extra class.
 *
 * @param params - Object with variant, size, href flag, and optional extra class.
 * @returns Space-joined class names string.
 */
export function buildBadgeClassName({
    variant,
    size,
    hasHref,
    extraClassName
}: {
    readonly variant: BadgeVariant;
    readonly size: BadgeSize;
    readonly hasHref: boolean;
    readonly extraClassName?: string;
}): string {
    const parts: string[] = ['badge', `badge--size-${size}`, `badge--variant-${variant}`];
    if (hasHref) parts.push('badge--interactive');
    if (extraClassName) parts.push(extraClassName);
    return parts.join(' ');
}

/**
 * CSS-Modules-scoped class names map used by the React Badge.
 * Keys mirror the camelCased class names declared in `Badge.module.css`.
 */
export interface BadgeStylesMap {
    readonly badge: string;
    readonly badgeInteractive: string;
    readonly badgeDot: string;
    readonly badgeSizeXs: string;
    readonly badgeSizeSm: string;
    readonly badgeSizeMd: string;
    readonly badgeVariantDefault: string;
    readonly badgeVariantFilledDark: string;
    readonly badgeVariantOutline: string;
    readonly badgeVariantDot: string;
}

/** Maps a `BadgeSize` to its corresponding `BadgeStylesMap` key. */
function sizeClassKey(size: BadgeSize): keyof BadgeStylesMap {
    switch (size) {
        case 'xs':
            return 'badgeSizeXs';
        case 'sm':
            return 'badgeSizeSm';
        case 'md':
            return 'badgeSizeMd';
    }
}

/** Maps a `BadgeVariant` to its corresponding `BadgeStylesMap` key. */
function variantClassKey(variant: BadgeVariant): keyof BadgeStylesMap {
    switch (variant) {
        case 'default':
            return 'badgeVariantDefault';
        case 'filled-dark':
            return 'badgeVariantFilledDark';
        case 'outline':
            return 'badgeVariantOutline';
        case 'dot':
            return 'badgeVariantDot';
    }
}

/**
 * Builds a class string of CSS-Module-scoped names for the React Badge.
 *
 * @param params - Object with the styles map, variant, size, href flag,
 *                 and an optional caller-provided extra class.
 * @returns Space-joined class names string using module-scoped names.
 */
export function buildBadgeClassList({
    styles,
    variant,
    size,
    hasHref,
    extraClassName
}: {
    readonly styles: BadgeStylesMap;
    readonly variant: BadgeVariant;
    readonly size: BadgeSize;
    readonly hasHref: boolean;
    readonly extraClassName?: string;
}): string {
    const parts: string[] = [
        styles.badge,
        styles[sizeClassKey(size)],
        styles[variantClassKey(variant)]
    ];
    if (hasHref) parts.push(styles.badgeInteractive);
    if (extraClassName) parts.push(extraClassName);
    return parts.filter(Boolean).join(' ');
}
