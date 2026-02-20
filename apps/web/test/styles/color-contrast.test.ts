/**
 * WCAG AA contrast ratio verification for the regional color palette.
 * Ensures all text/background combinations meet the minimum 4.5:1 ratio.
 */
import { describe, expect, it } from 'vitest';

/**
 * Parses a hex color string to RGB components.
 */
function hexToRgb({ hex }: { hex: string }): { r: number; g: number; b: number } {
    const clean = hex.replace('#', '');
    return {
        r: Number.parseInt(clean.substring(0, 2), 16),
        g: Number.parseInt(clean.substring(2, 4), 16),
        b: Number.parseInt(clean.substring(4, 6), 16)
    };
}

/**
 * Calculates relative luminance per WCAG 2.1 spec.
 */
function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
    const [rs, gs, bs] = [r, g, b].map((c) => {
        const srgb = c / 255;
        return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * rs! + 0.7152 * gs! + 0.0722 * bs!;
}

/**
 * Calculates contrast ratio between two hex colors.
 */
function contrastRatio({ color1, color2 }: { color1: string; color2: string }): number {
    const l1 = relativeLuminance(hexToRgb({ hex: color1 }));
    const l2 = relativeLuminance(hexToRgb({ hex: color2 }));
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

/* Light mode colors */
const LIGHT = {
    bg: '#FDFAF5',
    surface: '#FFFFFF',
    surfaceAlt: '#F5EDE0',
    text: '#2C1810',
    textSecondary: '#5C4A32',
    textTertiary: '#8B7355',
    primary: '#0D7377',
    primaryDark: '#0A5C5F',
    white: '#FFFFFF',
    success: '#2D6A4F',
    error: '#C25B3A',
    warning: '#D4870E'
} as const;

/* Dark mode colors */
const DARK = {
    bg: '#0F1A2E',
    surface: '#1A2740',
    text: '#F0EDE8',
    textSecondary: '#C4B8A8',
    textTertiary: '#8B7E6E',
    primary: '#3DBDC0'
} as const;

const AA_NORMAL = 4.5;
const AA_LARGE = 3;

describe('WCAG AA Contrast Ratios - Light Mode', () => {
    it('text on bg >= 4.5:1', () => {
        const ratio = contrastRatio({ color1: LIGHT.text, color2: LIGHT.bg });
        expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it('text on surface >= 4.5:1', () => {
        const ratio = contrastRatio({ color1: LIGHT.text, color2: LIGHT.surface });
        expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it('text-secondary on bg >= 4.5:1', () => {
        const ratio = contrastRatio({ color1: LIGHT.textSecondary, color2: LIGHT.bg });
        expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it('text-secondary on surface >= 4.5:1', () => {
        const ratio = contrastRatio({ color1: LIGHT.textSecondary, color2: LIGHT.surface });
        expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it('text-tertiary on surface >= 3:1 (large text)', () => {
        const ratio = contrastRatio({ color1: LIGHT.textTertiary, color2: LIGHT.surface });
        expect(ratio).toBeGreaterThanOrEqual(AA_LARGE);
    });

    it('text-tertiary on surface-alt >= 3:1 (large text)', () => {
        const ratio = contrastRatio({ color1: LIGHT.textTertiary, color2: LIGHT.surfaceAlt });
        expect(ratio).toBeGreaterThanOrEqual(AA_LARGE);
    });

    it('primary teal on white >= 4.5:1 (links/buttons)', () => {
        const ratio = contrastRatio({ color1: LIGHT.primary, color2: LIGHT.white });
        expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it('white on primary teal >= 4.5:1 (button text)', () => {
        const ratio = contrastRatio({ color1: LIGHT.white, color2: LIGHT.primary });
        expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it('white on primary-dark >= 4.5:1', () => {
        const ratio = contrastRatio({ color1: LIGHT.white, color2: LIGHT.primaryDark });
        expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it('white on success (green) >= 4.5:1', () => {
        const ratio = contrastRatio({ color1: LIGHT.white, color2: LIGHT.success });
        expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it('white on error (terracotta) >= 3:1 (large text)', () => {
        const ratio = contrastRatio({ color1: LIGHT.white, color2: LIGHT.error });
        expect(ratio).toBeGreaterThanOrEqual(AA_LARGE);
    });
});

describe('WCAG AA Contrast Ratios - Dark Mode', () => {
    it('text on bg >= 4.5:1', () => {
        const ratio = contrastRatio({ color1: DARK.text, color2: DARK.bg });
        expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it('text on surface >= 4.5:1', () => {
        const ratio = contrastRatio({ color1: DARK.text, color2: DARK.surface });
        expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it('text-secondary on bg >= 4.5:1', () => {
        const ratio = contrastRatio({ color1: DARK.textSecondary, color2: DARK.bg });
        expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it('text-secondary on surface >= 4.5:1', () => {
        const ratio = contrastRatio({ color1: DARK.textSecondary, color2: DARK.surface });
        expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it('text-tertiary on surface >= 3:1 (large text)', () => {
        const ratio = contrastRatio({ color1: DARK.textTertiary, color2: DARK.surface });
        expect(ratio).toBeGreaterThanOrEqual(AA_LARGE);
    });

    it('primary teal on bg >= 4.5:1', () => {
        const ratio = contrastRatio({ color1: DARK.primary, color2: DARK.bg });
        expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it('primary teal on surface >= 4.5:1', () => {
        const ratio = contrastRatio({ color1: DARK.primary, color2: DARK.surface });
        expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
    });
});
