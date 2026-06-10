/**
 * @file badge.utils.test.ts
 * @description Unit tests for pure Badge utility functions
 * (padding, icon/font sizes, min-height, inline style, class list).
 */

import type { BadgeColorScheme } from '@/components/shared/ui/badge.types';
import type { BadgeStylesMap } from '@/components/shared/ui/badge.utils';
import {
    buildBadgeClassList,
    buildBadgeClassName,
    buildBadgeInlineStyle,
    buildBadgeStyleObject,
    getBadgeFontSize,
    getBadgeIconSize,
    getBadgeMinHeight,
    getBadgePadding
} from '@/components/shared/ui/badge.utils';
import { describe, expect, it } from 'vitest';

const scheme: BadgeColorScheme = {
    bg: 'rgba(0, 0, 0, 0.05)',
    text: 'var(--brand-accent)',
    border: 'rgba(0, 0, 0, 0.1)'
};

describe('getBadgePadding', () => {
    it('returns 0 6px for xs', () => {
        expect(getBadgePadding({ size: 'xs' })).toBe('0 6px');
    });

    it('returns 2px 8px for sm', () => {
        expect(getBadgePadding({ size: 'sm' })).toBe('2px 8px');
    });

    it('returns 4px 12px for md', () => {
        expect(getBadgePadding({ size: 'md' })).toBe('4px 12px');
    });
});

describe('getBadgeIconSize', () => {
    it('returns 12 for xs', () => {
        expect(getBadgeIconSize({ size: 'xs' })).toBe(12);
    });

    it('returns 14 for sm', () => {
        expect(getBadgeIconSize({ size: 'sm' })).toBe(14);
    });

    it('returns 16 for md', () => {
        expect(getBadgeIconSize({ size: 'md' })).toBe(16);
    });
});

describe('getBadgeFontSize', () => {
    it('returns 0.6875rem for xs', () => {
        expect(getBadgeFontSize({ size: 'xs' })).toBe('0.6875rem');
    });

    it('returns 0.75rem for sm', () => {
        expect(getBadgeFontSize({ size: 'sm' })).toBe('0.75rem');
    });

    it('returns 0.875rem for md', () => {
        expect(getBadgeFontSize({ size: 'md' })).toBe('0.875rem');
    });
});

describe('getBadgeMinHeight', () => {
    describe('when clickable (hasHref: true)', () => {
        it('returns 24px for xs', () => {
            expect(getBadgeMinHeight({ size: 'xs', hasHref: true })).toBe('24px');
        });

        it('returns 44px for sm', () => {
            expect(getBadgeMinHeight({ size: 'sm', hasHref: true })).toBe('44px');
        });

        it('returns 44px for md', () => {
            expect(getBadgeMinHeight({ size: 'md', hasHref: true })).toBe('44px');
        });
    });

    describe('when decorative (hasHref: false)', () => {
        it('returns auto for xs', () => {
            expect(getBadgeMinHeight({ size: 'xs', hasHref: false })).toBe('auto');
        });

        it('returns auto for sm', () => {
            expect(getBadgeMinHeight({ size: 'sm', hasHref: false })).toBe('auto');
        });

        it('returns auto for md', () => {
            expect(getBadgeMinHeight({ size: 'md', hasHref: false })).toBe('auto');
        });
    });
});

describe('buildBadgeInlineStyle', () => {
    it('uses colorScheme values for default variant', () => {
        const style = buildBadgeInlineStyle({
            variant: 'default',
            colorScheme: scheme,
            size: 'sm',
            hasHref: false
        });
        expect(style).toContain(`background-color: ${scheme.bg}`);
        expect(style).toContain(`color: ${scheme.text}`);
        expect(style).toContain(`border: 1px solid ${scheme.border}`);
    });

    it('uses core foreground/background for filled-dark variant', () => {
        const style = buildBadgeInlineStyle({
            variant: 'filled-dark',
            colorScheme: scheme,
            size: 'sm',
            hasHref: false
        });
        expect(style).toContain('background-color: var(--core-foreground)');
        expect(style).toContain('color: var(--core-background)');
        expect(style).toContain('border: none');
    });

    it('uses transparent background for outline variant', () => {
        const style = buildBadgeInlineStyle({
            variant: 'outline',
            colorScheme: scheme,
            size: 'sm',
            hasHref: false
        });
        expect(style).toContain('background-color: transparent');
        expect(style).toContain(`color: ${scheme.text}`);
        expect(style).toContain(`border: 1px solid ${scheme.border}`);
    });

    it('uses muted foreground tokens for dot variant', () => {
        const style = buildBadgeInlineStyle({
            variant: 'dot',
            colorScheme: scheme,
            size: 'sm',
            hasHref: false
        });
        // SPEC-176 commit cd468c2cb replaced oklch(from var(--core-muted-foreground) ...)
        // with pre-built alpha tokens (var(--core-muted-foreground-a08 / -a15)) for
        // Chrome <119 compatibility. Assert the new alpha-variant form.
        expect(style).toContain('background-color: var(--core-muted-foreground-a08)');
        expect(style).toContain('color: var(--core-foreground)');
        expect(style).toContain('border: 1px solid var(--core-muted-foreground-a15)');
    });

    it('applies 44px min-height when hasHref and size >= sm', () => {
        const style = buildBadgeInlineStyle({
            variant: 'default',
            colorScheme: scheme,
            size: 'sm',
            hasHref: true
        });
        expect(style).toContain('min-height: 44px');
    });

    it('applies auto min-height when not clickable', () => {
        const style = buildBadgeInlineStyle({
            variant: 'default',
            colorScheme: scheme,
            size: 'md',
            hasHref: false
        });
        expect(style).toContain('min-height: auto');
    });
});

describe('buildBadgeStyleObject', () => {
    it('produces an object with backgroundColor, color, border', () => {
        const obj = buildBadgeStyleObject({
            variant: 'default',
            colorScheme: scheme,
            size: 'sm',
            hasHref: true
        });
        expect(obj.backgroundColor).toBe(scheme.bg);
        expect(obj.color).toBe(scheme.text);
        expect(obj.border).toBe(`1px solid ${scheme.border}`);
        expect(obj.minHeight).toBe('44px');
    });
});

describe('buildBadgeClassName', () => {
    it('always includes base badge class and size/variant modifiers', () => {
        const cls = buildBadgeClassName({
            variant: 'default',
            size: 'sm',
            hasHref: false
        });
        expect(cls).toContain('badge');
        expect(cls).toContain('badge--size-sm');
        expect(cls).toContain('badge--variant-default');
        expect(cls).not.toContain('badge--interactive');
    });

    it('adds interactive modifier when hasHref is true', () => {
        const cls = buildBadgeClassName({
            variant: 'outline',
            size: 'md',
            hasHref: true
        });
        expect(cls).toContain('badge--interactive');
        expect(cls).toContain('badge--variant-outline');
        expect(cls).toContain('badge--size-md');
    });

    it('appends extraClassName when provided', () => {
        const cls = buildBadgeClassName({
            variant: 'default',
            size: 'xs',
            hasHref: false,
            extraClassName: 'custom-class'
        });
        expect(cls.endsWith('custom-class')).toBe(true);
    });
});

describe('buildBadgeClassList', () => {
    const stylesMap: BadgeStylesMap = {
        badge: 'BADGE',
        badgeInteractive: 'INTERACTIVE',
        badgeDot: 'DOT',
        badgeSizeXs: 'SIZE_XS',
        badgeSizeSm: 'SIZE_SM',
        badgeSizeMd: 'SIZE_MD',
        badgeVariantDefault: 'VAR_DEFAULT',
        badgeVariantFilledDark: 'VAR_FILLED_DARK',
        badgeVariantOutline: 'VAR_OUTLINE',
        badgeVariantDot: 'VAR_DOT'
    };

    it('resolves size and variant classes via the styles map', () => {
        const cls = buildBadgeClassList({
            styles: stylesMap,
            variant: 'outline',
            size: 'md',
            hasHref: false
        });
        expect(cls).toContain('BADGE');
        expect(cls).toContain('SIZE_MD');
        expect(cls).toContain('VAR_OUTLINE');
        expect(cls).not.toContain('INTERACTIVE');
    });

    it('adds interactive class when hasHref is true', () => {
        const cls = buildBadgeClassList({
            styles: stylesMap,
            variant: 'default',
            size: 'sm',
            hasHref: true
        });
        expect(cls).toContain('INTERACTIVE');
    });

    it('appends extraClassName', () => {
        const cls = buildBadgeClassList({
            styles: stylesMap,
            variant: 'default',
            size: 'xs',
            hasHref: false,
            extraClassName: 'extra'
        });
        expect(cls.endsWith('extra')).toBe(true);
    });
});
