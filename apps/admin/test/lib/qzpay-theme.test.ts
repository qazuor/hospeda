/**
 * Tests for Admin QZPay theme configuration
 */

import { qzpayMergeTheme } from '@qazuor/qzpay-react';
import { describe, expect, it } from 'vitest';
import { adminQzpayDarkTheme, adminQzpayTheme } from '../../src/lib/qzpay-theme';

describe('adminQzpayTheme', () => {
    it('should be a valid QZPayTheme object', () => {
        expect(adminQzpayTheme).toBeDefined();
        expect(adminQzpayTheme).toHaveProperty('colors');
        expect(adminQzpayTheme).toHaveProperty('typography');
        expect(adminQzpayTheme).toHaveProperty('spacing');
        expect(adminQzpayTheme).toHaveProperty('borderRadius');
        expect(adminQzpayTheme).toHaveProperty('shadows');
        expect(adminQzpayTheme).toHaveProperty('transitions');
    });

    it('should have all required color properties', () => {
        const { colors } = adminQzpayTheme;

        expect(colors).toHaveProperty('primary');
        expect(colors).toHaveProperty('primaryHover');
        expect(colors).toHaveProperty('primaryText');
        expect(colors).toHaveProperty('secondary');
        expect(colors).toHaveProperty('error');
        expect(colors).toHaveProperty('background');
        expect(colors).toHaveProperty('surface');
        expect(colors).toHaveProperty('border');
        expect(colors).toHaveProperty('text');
    });

    it('should use Shadcn UI-compatible colors', () => {
        const { colors } = adminQzpayTheme;

        // Primary: Neutral dark (slate-800)
        expect(colors.primary).toBe('#1e293b');

        // Error: Red-500
        expect(colors.error).toBe('#ef4444');

        // Border: Slate-200
        expect(colors.border).toBe('#e2e8f0');
    });

    it('should use system font stack', () => {
        const { typography } = adminQzpayTheme;

        expect(typography.fontFamily).toContain('BlinkMacSystemFont');
        expect(typography.fontFamily).toContain('Segoe UI');
        expect(typography.fontFamily).toContain('Roboto');
    });

    it('should have denser spacing than web theme', () => {
        const { spacing } = adminQzpayTheme;

        // Admin should have smaller spacing values for density
        expect(spacing.xs).toBe('0.25rem'); // 4px - denser
        expect(spacing.sm).toBe('0.5rem'); // 8px - denser
        expect(spacing.md).toBe('1rem'); // 16px
    });

    it('should have smaller base font size for admin density', () => {
        const { typography } = adminQzpayTheme;

        // Admin uses 14px base (0.875rem) vs web's 16px (1rem)
        expect(typography.fontSizeBase).toBe('0.875rem');
    });

    it('should use Shadcn border radius values', () => {
        const { borderRadius } = adminQzpayTheme;

        // Shadcn uses --radius: 0.625rem (10px)
        expect(borderRadius.lg).toBe('0.625rem'); // 10px
    });

    it('should have snappier transitions for admin', () => {
        const { transitions } = adminQzpayTheme;

        // Admin should have faster transitions
        expect(transitions.fast).toBe('100ms');
        expect(transitions.normal).toBe('150ms');
        expect(transitions.slow).toBe('200ms');
    });
});

describe('adminQzpayDarkTheme', () => {
    it('should be a valid QZPayTheme object', () => {
        expect(adminQzpayDarkTheme).toBeDefined();
        expect(adminQzpayDarkTheme).toHaveProperty('colors');
        expect(adminQzpayDarkTheme).toHaveProperty('typography');
        expect(adminQzpayDarkTheme).toHaveProperty('spacing');
    });

    it('should use Shadcn dark mode colors', () => {
        const { colors } = adminQzpayDarkTheme;

        // Background: Slate-900 (from Shadcn .dark)
        expect(colors.background).toBe('#0f172a');

        // Surface: Slate-800
        expect(colors.surface).toBe('#1e293b');

        // Text: Slate-50 (light on dark)
        expect(colors.text).toBe('#f8fafc');
    });

    it('should use brighter primary for dark mode', () => {
        const { colors } = adminQzpayDarkTheme;

        // Dark mode primary should be violet-500 (brighter)
        expect(colors.primary).toBe('#8b5cf6');
        expect(colors.primaryHover).toBe('#a78bfa'); // violet-400
    });

    it('should inherit spacing from light theme', () => {
        expect(adminQzpayDarkTheme.spacing).toEqual(adminQzpayTheme.spacing);
    });

    it('should inherit typography from light theme', () => {
        expect(adminQzpayDarkTheme.typography).toEqual(adminQzpayTheme.typography);
    });

    it('should have darker shadows', () => {
        const darkShadow = adminQzpayDarkTheme.shadows.md;

        // Dark shadows should have higher opacity
        expect(darkShadow).toContain('0.4');
    });
});

describe('admin theme consistency', () => {
    it('should have matching structure between light and dark themes', () => {
        const lightKeys = Object.keys(adminQzpayTheme);
        const darkKeys = Object.keys(adminQzpayDarkTheme);

        expect(darkKeys).toEqual(lightKeys);
    });

    it('should have matching color properties', () => {
        const lightColorKeys = Object.keys(adminQzpayTheme.colors).sort();
        const darkColorKeys = Object.keys(adminQzpayDarkTheme.colors).sort();

        expect(darkColorKeys).toEqual(lightColorKeys);
    });

    it('should preserve spacing across themes', () => {
        expect(adminQzpayDarkTheme.spacing).toEqual(adminQzpayTheme.spacing);
    });

    it('should preserve typography across themes', () => {
        expect(adminQzpayDarkTheme.typography).toEqual(adminQzpayTheme.typography);
    });
});

describe('admin theme overrides', () => {
    it('should allow partial overrides with qzpayMergeTheme', () => {
        const customTheme = qzpayMergeTheme(adminQzpayTheme, {
            colors: {
                primary: '#000000'
            }
        });

        expect(customTheme.colors.primary).toBe('#000000');
        expect(customTheme.colors.secondary).toBe(adminQzpayTheme.colors.secondary);
    });

    it('should preserve all properties when merging', () => {
        const customTheme = qzpayMergeTheme(adminQzpayTheme, {
            spacing: {
                lg: '3rem'
            }
        });

        expect(customTheme.spacing.lg).toBe('3rem');
        expect(customTheme.spacing.md).toBe(adminQzpayTheme.spacing.md);
        expect(customTheme.colors).toEqual(adminQzpayTheme.colors);
    });
});

describe('admin vs web theme differences', () => {
    // Note: Can't import web theme in admin tests due to separate apps
    // These tests document the expected differences

    it('should have denser spacing than web theme', () => {
        const { spacing } = adminQzpayTheme;

        // Admin xs = 4px, web xs = 8px (expected)
        expect(spacing.xs).toBe('0.25rem');

        // Admin sm = 8px, web sm = 12px (expected)
        expect(spacing.sm).toBe('0.5rem');
    });

    it('should have smaller base font size than web', () => {
        const { typography } = adminQzpayTheme;

        // Admin: 14px (0.875rem), Web: 16px (1rem) expected
        expect(typography.fontSizeBase).toBe('0.875rem');
    });

    it('should have faster transitions than web', () => {
        const { transitions } = adminQzpayTheme;

        // Admin fast = 100ms, web fast = 150ms (expected)
        expect(transitions.fast).toBe('100ms');
    });

    it('should use different primary colors', () => {
        const { colors } = adminQzpayTheme;

        // Admin uses neutral slate, web uses teal (expected)
        expect(colors.primary).toBe('#1e293b'); // slate-800
        // Web would be '#14b8a6' (teal-500)
    });
});

describe('color format validation', () => {
    it('should use hex color format', () => {
        const { colors } = adminQzpayTheme;
        const hexRegex = /^#[0-9a-fA-F]{6}$/;

        expect(colors.primary).toMatch(hexRegex);
        expect(colors.secondary).toMatch(hexRegex);
        expect(colors.error).toMatch(hexRegex);
    });

    it('should have valid background colors', () => {
        const { colors } = adminQzpayTheme;

        expect(colors.background).toBe('#ffffff');
        expect(colors.surface).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
});

describe('typography validation', () => {
    it('should have valid font sizes', () => {
        const { typography } = adminQzpayTheme;

        expect(typography.fontSizeBase).toBe('0.875rem');
        expect(typography.fontSizeSm).toBe('0.75rem');
        expect(typography.fontSizeLg).toBe('1rem');
    });

    it('should have valid font weights', () => {
        const { typography } = adminQzpayTheme;

        expect(typography.fontWeightNormal).toBe(400);
        expect(typography.fontWeightMedium).toBe(500);
        expect(typography.fontWeightBold).toBe(700);
    });

    it('should have valid line heights', () => {
        const { typography } = adminQzpayTheme;

        expect(typography.lineHeightBase).toBeGreaterThan(1);
        expect(typography.lineHeightTight).toBeLessThan(typography.lineHeightBase);
        expect(typography.lineHeightRelaxed).toBeGreaterThan(typography.lineHeightBase);
    });
});
