/**
 * Hospeda QZPay Theme Configuration - Admin Application
 *
 * Extends the web theme with admin-specific customizations:
 * - Slightly denser spacing for data-heavy interfaces
 * - Uses Shadcn UI design tokens from admin/src/styles.css
 * - Maps oklch color values to qzpay-react theme
 *
 * @module lib/qzpay-theme
 */

import { qzpayMergeTheme } from '@qazuor/qzpay-react';
import type { QZPayTheme } from '@qazuor/qzpay-react';

/**
 * Convert oklch color string to rgb hex for qzpay-react
 * Admin uses oklch colors from Shadcn UI, but qzpay-react expects hex/rgb
 *
 * Note: For now, using approximate hex conversions.
 * In production, consider using a proper oklch-to-hex converter.
 */

/**
 * Base admin theme using Shadcn UI design tokens
 *
 * Colors are derived from admin/src/styles.css CSS variables:
 * - Primary: oklch(0.21 0.006 285.885) ≈ #1e293b (slate-800)
 * - Secondary: oklch(0.967 0.001 286.375) ≈ #f1f5f9 (slate-100)
 * - Destructive: oklch(0.577 0.245 27.325) ≈ #ef4444 (red-500)
 * - Border: oklch(0.92 0.004 286.32) ≈ #e2e8f0 (slate-200)
 *
 * Border radius uses --radius: 0.625rem (10px) from Shadcn config
 */
export const adminQzpayTheme: QZPayTheme = {
    colors: {
        // Primary - Using Shadcn primary (neutral dark)
        primary: '#1e293b', // ~oklch(0.21 0.006 285.885) / slate-800
        primaryHover: '#0f172a', // slate-900 for hover
        primaryText: '#ffffff',

        // Secondary - Using Shadcn secondary (light neutral)
        secondary: '#64748b', // slate-500
        secondaryHover: '#475569', // slate-600
        secondaryText: '#ffffff',

        // Success - Green
        success: '#22c55e', // green-500
        successBackground: '#dcfce7', // green-100
        successText: '#166534', // green-800

        // Warning - Amber
        warning: '#f59e0b', // amber-500
        warningBackground: '#fef3c7', // amber-100
        warningText: '#92400e', // amber-800

        // Destructive/Error - From Shadcn destructive
        error: '#ef4444', // ~oklch(0.577 0.245 27.325) / red-500
        errorBackground: '#fee2e2', // red-100
        errorText: '#ef4444', // red-500

        // Backgrounds - Using Shadcn background tokens
        background: '#ffffff', // ~oklch(1 0 0)
        surface: '#f8fafc', // slate-50
        border: '#e2e8f0', // ~oklch(0.92 0.004 286.32) / slate-200
        muted: '#94a3b8', // slate-400

        // Text - Using Shadcn foreground tokens
        text: '#0f172a', // ~oklch(0.141 0.005 285.823) / slate-900
        textSecondary: '#64748b', // slate-500
        textDisabled: '#cbd5e1' // slate-300
    },

    typography: {
        // Match system font stack from admin/src/styles.css
        fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
        fontFamilyMono: 'source-code-pro, Menlo, Monaco, Consolas, "Courier New", monospace',
        fontSizeBase: '0.875rem', // 14px - denser for admin
        fontSizeSm: '0.75rem', // 12px
        fontSizeLg: '1rem', // 16px
        fontSizeXl: '1.25rem', // 20px
        fontWeightNormal: 400,
        fontWeightMedium: 500,
        fontWeightBold: 700,
        lineHeightBase: 1.5,
        lineHeightTight: 1.25,
        lineHeightRelaxed: 1.75
    },

    spacing: {
        // Slightly denser spacing for admin interfaces
        xs: '0.25rem', // 4px
        sm: '0.5rem', // 8px
        md: '1rem', // 16px
        lg: '1.5rem', // 24px
        xl: '2rem', // 32px
        xxl: '3rem' // 48px
    },

    borderRadius: {
        // Match Shadcn --radius values (0.625rem base)
        none: '0',
        sm: 'calc(0.625rem - 4px)', // ~0.375rem / 6px
        md: 'calc(0.625rem - 2px)', // ~0.525rem / 8.4px
        lg: '0.625rem', // 10px (Shadcn default)
        xl: 'calc(0.625rem + 4px)', // ~0.875rem / 14px
        full: '9999px'
    },

    shadows: {
        // Subtle shadows for professional admin UI
        none: 'none',
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        md: '0 2px 4px -1px rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        lg: '0 4px 6px -2px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
    },

    transitions: {
        // Snappy transitions for admin interactions
        fast: '100ms',
        normal: '150ms',
        slow: '200ms',
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
    }
};

/**
 * Dark mode theme for admin
 *
 * Uses Shadcn dark mode CSS variables from .dark selector
 */
export const adminQzpayDarkTheme: QZPayTheme = qzpayMergeTheme(adminQzpayTheme, {
    colors: {
        // Primary - Brighter for dark mode
        primary: '#8b5cf6', // ~oklch(0.488 0.243 264.376) / violet-500
        primaryHover: '#a78bfa', // violet-400
        primaryText: '#ffffff',

        // Secondary - Dark mode neutral
        secondary: '#94a3b8', // slate-400
        secondaryHover: '#cbd5e1', // slate-300
        secondaryText: '#0f172a', // slate-900

        // Success
        success: '#22c55e', // green-500
        successBackground: '#14532d', // ~oklch(0.14532d 0.14532d 0.14532d) / green-900
        successText: '#86efac', // ~oklch(0.86efac 0.86efac 0.86efac) / green-300

        // Warning
        warning: '#fbbf24', // ~oklch(0.fbbf24 0.fbbf24 0.fbbf24) / amber-400
        warningBackground: '#78350f', // ~oklch(0.78350f 0.78350f 0.78350f) / amber-900
        warningText: '#fde68a', // ~oklch(0.fde68a 0.fde68a 0.fde68a) / amber-200

        // Error
        error: '#f87171', // ~oklch(0.645 0.246 16.439) / red-400
        errorBackground: '#7f1d1d', // ~oklch(0.396 0.141 25.723) / red-900
        errorText: '#fca5a5', // ~oklch(0.637 0.237 25.331) / red-300

        // Backgrounds - Dark mode from Shadcn
        background: '#0f172a', // ~oklch(0.141 0.005 285.823) / slate-900
        surface: '#1e293b', // ~oklch(0.274 0.006 286.033) / slate-800
        border: '#334155', // ~oklch(0.274 0.006 286.033) / slate-700
        muted: '#64748b', // slate-500

        // Text - Dark mode
        text: '#f8fafc', // ~oklch(0.985 0 0) / slate-50
        textSecondary: '#94a3b8', // ~oklch(0.705 0.015 286.067) / slate-400
        textDisabled: '#64748b' // slate-500
    },

    shadows: {
        // Darker shadows for dark mode depth
        none: 'none',
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.3)',
        md: '0 2px 4px -1px rgb(0 0 0 / 0.4), 0 1px 2px -1px rgb(0 0 0 / 0.4)',
        lg: '0 4px 6px -2px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.4)'
    }
});
