/**
 * Tests for Hospeda QZPay theme configuration
 */

import { qzpayDefaultTheme, qzpayMergeTheme } from '@qazuor/qzpay-react';
import { describe, expect, it } from 'vitest';
import { hospedaQzpayDarkTheme, hospedaQzpayTheme } from '../../src/lib/qzpay-theme';

describe('hospedaQzpayTheme', () => {
    it('should be a valid QZPayTheme object', () => {
        expect(hospedaQzpayTheme).toBeDefined();
        expect(hospedaQzpayTheme).toHaveProperty('colors');
        expect(hospedaQzpayTheme).toHaveProperty('typography');
        expect(hospedaQzpayTheme).toHaveProperty('spacing');
        expect(hospedaQzpayTheme).toHaveProperty('borderRadius');
        expect(hospedaQzpayTheme).toHaveProperty('shadows');
        expect(hospedaQzpayTheme).toHaveProperty('transitions');
    });

    it('should have all required color properties', () => {
        const { colors } = hospedaQzpayTheme;

        expect(colors).toHaveProperty('primary');
        expect(colors).toHaveProperty('primaryHover');
        expect(colors).toHaveProperty('primaryText');
        expect(colors).toHaveProperty('secondary');
        expect(colors).toHaveProperty('secondaryHover');
        expect(colors).toHaveProperty('secondaryText');
        expect(colors).toHaveProperty('success');
        expect(colors).toHaveProperty('warning');
        expect(colors).toHaveProperty('error');
        expect(colors).toHaveProperty('background');
        expect(colors).toHaveProperty('surface');
        expect(colors).toHaveProperty('border');
        expect(colors).toHaveProperty('text');
    });

    it('should use Hospeda brand colors', () => {
        const { colors } = hospedaQzpayTheme;

        // Primary: Teal
        expect(colors.primary).toBe('#14b8a6'); // primary-500
        expect(colors.primaryHover).toBe('#0d9488'); // primary-600

        // Secondary: Sky Blue
        expect(colors.secondary).toBe('#0ea5e9'); // secondary-500
        expect(colors.secondaryHover).toBe('#0284c7'); // secondary-600

        // Warning: Orange (accent)
        expect(colors.warning).toBe('#f2750a'); // accent-500
    });

    it('should use Inter font family', () => {
        const { typography } = hospedaQzpayTheme;

        expect(typography.fontFamily).toContain('Inter');
        expect(typography.fontFamily).toContain('system-ui');
    });

    it('should match Hospeda spacing scale', () => {
        const { spacing } = hospedaQzpayTheme;

        expect(spacing.xs).toBe('0.5rem'); // 8px
        expect(spacing.sm).toBe('0.75rem'); // 12px
        expect(spacing.md).toBe('1rem'); // 16px
        expect(spacing.lg).toBe('1.5rem'); // 24px
        expect(spacing.xl).toBe('2rem'); // 32px
        expect(spacing.xxl).toBe('3rem'); // 48px
    });

    it('should use Tailwind-compatible border radius', () => {
        const { borderRadius } = hospedaQzpayTheme;

        expect(borderRadius.none).toBe('0');
        expect(borderRadius.sm).toBe('0.25rem'); // 4px
        expect(borderRadius.md).toBe('0.5rem'); // 8px (rounded-md)
        expect(borderRadius.lg).toBe('0.75rem'); // 12px
        expect(borderRadius.full).toBe('9999px');
    });

    it('should be created by merging with default theme', () => {
        // Verify that the theme is compatible with qzpayMergeTheme
        const mergedTheme = qzpayMergeTheme(qzpayDefaultTheme, {
            colors: {
                primary: hospedaQzpayTheme.colors.primary
            }
        });

        expect(mergedTheme.colors.primary).toBe(hospedaQzpayTheme.colors.primary);
        expect(mergedTheme.typography).toBeDefined();
        expect(mergedTheme.spacing).toBeDefined();
    });
});

describe('hospedaQzpayDarkTheme', () => {
    it('should be a valid QZPayTheme object', () => {
        expect(hospedaQzpayDarkTheme).toBeDefined();
        expect(hospedaQzpayDarkTheme).toHaveProperty('colors');
        expect(hospedaQzpayDarkTheme).toHaveProperty('typography');
        expect(hospedaQzpayDarkTheme).toHaveProperty('spacing');
    });

    it('should use brighter colors for dark mode', () => {
        const { colors } = hospedaQzpayDarkTheme;

        // Primary should be lighter/brighter than light mode
        expect(colors.primary).toBe('#2dd4bf'); // primary-400 (brighter)
        expect(colors.secondary).toBe('#38bdf8'); // secondary-400 (brighter)
    });

    it('should have dark background colors', () => {
        const { colors } = hospedaQzpayDarkTheme;

        expect(colors.background).toBe('#111827'); // gray-900
        expect(colors.surface).toBe('#1f2937'); // gray-800
        expect(colors.text).toBe('#f9fafb'); // gray-50 (light text on dark bg)
    });

    it('should inherit typography from light theme', () => {
        expect(hospedaQzpayDarkTheme.typography.fontFamily).toBe(
            hospedaQzpayTheme.typography.fontFamily
        );
        expect(hospedaQzpayDarkTheme.spacing).toEqual(hospedaQzpayTheme.spacing);
    });

    it('should have darker shadows than light theme', () => {
        const lightShadow = hospedaQzpayTheme.shadows.md;
        const darkShadow = hospedaQzpayDarkTheme.shadows.md;

        // Dark theme shadows should have higher opacity
        expect(darkShadow).toContain('0.3'); // Higher opacity than light theme
        expect(lightShadow).toContain('0.1'); // Lower opacity
    });
});

describe('theme consistency', () => {
    it('should have matching structure between light and dark themes', () => {
        const lightKeys = Object.keys(hospedaQzpayTheme);
        const darkKeys = Object.keys(hospedaQzpayDarkTheme);

        expect(darkKeys).toEqual(lightKeys);
    });

    it('should have matching color properties', () => {
        const lightColorKeys = Object.keys(hospedaQzpayTheme.colors).sort();
        const darkColorKeys = Object.keys(hospedaQzpayDarkTheme.colors).sort();

        expect(darkColorKeys).toEqual(lightColorKeys);
    });

    it('should preserve spacing across themes', () => {
        expect(hospedaQzpayDarkTheme.spacing).toEqual(hospedaQzpayTheme.spacing);
    });

    it('should preserve typography across themes', () => {
        expect(hospedaQzpayDarkTheme.typography).toEqual(hospedaQzpayTheme.typography);
    });

    it('should preserve border radius across themes', () => {
        expect(hospedaQzpayDarkTheme.borderRadius).toEqual(hospedaQzpayTheme.borderRadius);
    });

    it('should preserve transitions across themes', () => {
        expect(hospedaQzpayDarkTheme.transitions).toEqual(hospedaQzpayTheme.transitions);
    });
});

describe('theme overrides', () => {
    it('should allow partial overrides with qzpayMergeTheme', () => {
        const customTheme = qzpayMergeTheme(hospedaQzpayTheme, {
            colors: {
                primary: '#ff0000'
            }
        });

        expect(customTheme.colors.primary).toBe('#ff0000');
        expect(customTheme.colors.secondary).toBe(hospedaQzpayTheme.colors.secondary);
        expect(customTheme.typography).toEqual(hospedaQzpayTheme.typography);
    });

    it('should preserve all theme properties when merging', () => {
        const customTheme = qzpayMergeTheme(hospedaQzpayTheme, {
            spacing: {
                md: '2rem'
            }
        });

        expect(customTheme.spacing.md).toBe('2rem');
        expect(customTheme.spacing.sm).toBe(hospedaQzpayTheme.spacing.sm);
        expect(customTheme.colors).toEqual(hospedaQzpayTheme.colors);
    });
});

describe('color format validation', () => {
    it('should use hex color format', () => {
        const { colors } = hospedaQzpayTheme;
        const hexRegex = /^#[0-9a-fA-F]{6}$/;

        expect(colors.primary).toMatch(hexRegex);
        expect(colors.secondary).toMatch(hexRegex);
        expect(colors.success).toMatch(hexRegex);
        expect(colors.warning).toMatch(hexRegex);
        expect(colors.error).toMatch(hexRegex);
    });

    it('should have valid background colors', () => {
        const { colors } = hospedaQzpayTheme;

        expect(colors.background).toBe('#ffffff');
        expect(colors.surface).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(colors.border).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
});

describe('typography validation', () => {
    it('should have valid font sizes', () => {
        const { typography } = hospedaQzpayTheme;

        expect(typography.fontSizeBase).toBe('1rem');
        expect(typography.fontSizeSm).toBe('0.875rem');
        expect(typography.fontSizeLg).toBe('1.125rem');
        expect(typography.fontSizeXl).toBe('1.5rem');
    });

    it('should have valid font weights', () => {
        const { typography } = hospedaQzpayTheme;

        expect(typography.fontWeightNormal).toBe(400);
        expect(typography.fontWeightMedium).toBe(500);
        expect(typography.fontWeightBold).toBe(700);
    });

    it('should have valid line heights', () => {
        const { typography } = hospedaQzpayTheme;

        expect(typography.lineHeightBase).toBeGreaterThan(1);
        expect(typography.lineHeightTight).toBeLessThan(typography.lineHeightBase);
        expect(typography.lineHeightRelaxed).toBeGreaterThan(typography.lineHeightBase);
    });
});
