/**
 * Hospeda QZPay Theme Configuration - Web Application
 *
 * Maps Hospeda's Tailwind CSS color palette to the qzpay-react theme system.
 * Uses Hospeda's design tokens (teal primary, sky secondary, orange accent)
 * from tailwind.config.ts and matches the Inter font stack.
 *
 * @module lib/qzpay-theme
 */

import { qzpayDefaultTheme, qzpayMergeTheme } from '@qazuor/qzpay-react';
import type { QZPayTheme } from '@qazuor/qzpay-react';

/**
 * Hospeda-specific theme for QZPay React components
 *
 * Color mapping from Hospeda's Tailwind palette:
 * - Primary: Teal (#14b8a6 / primary-500)
 * - Secondary: Sky Blue (#0ea5e9 / secondary-500)
 * - Accent: Orange (#f2750a / accent-500)
 * - Typography: Inter font family
 * - Spacing: Matches Hospeda's custom spacing scale
 * - Border radius: Uses 0.5rem (8px) to match Tailwind rounded-md default
 */
export const hospedaQzpayTheme: QZPayTheme = qzpayMergeTheme(qzpayDefaultTheme, {
    colors: {
        // Primary - Teal (Hospeda brand color)
        primary: '#14b8a6', // primary-500
        primaryHover: '#0d9488', // primary-600
        primaryText: '#ffffff',

        // Secondary - Sky Blue
        secondary: '#0ea5e9', // secondary-500
        secondaryHover: '#0284c7', // secondary-600
        secondaryText: '#ffffff',

        // Success - Keep default green but lighter
        success: '#14b8a6', // Using primary teal for success
        successBackground: '#ccfbf1', // primary-100
        successText: '#0f766e', // primary-700

        // Warning - Amber/Orange (Hospeda accent)
        warning: '#f2750a', // accent-500
        warningBackground: '#fdedd3', // accent-100
        warningText: '#bc4508', // accent-700

        // Error - Red (keeping default)
        error: '#dc2626', // red-600
        errorBackground: '#fee2e2', // red-100
        errorText: '#dc2626', // red-600

        // Backgrounds - Light mode defaults
        background: '#ffffff',
        surface: '#f9fafb', // gray-50
        border: '#e5e7eb', // gray-200
        muted: '#9ca3af', // gray-400

        // Text colors
        text: '#111827', // gray-900
        textSecondary: '#6b7280', // gray-500
        textDisabled: '#9ca3af' // gray-400
    },

    typography: {
        // Match Hospeda's Inter font stack
        fontFamily: 'Inter, system-ui, sans-serif',
        fontFamilyMono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSizeBase: '1rem', // 16px
        fontSizeSm: '0.875rem', // 14px
        fontSizeLg: '1.125rem', // 18px
        fontSizeXl: '1.5rem', // 24px
        fontWeightNormal: 400,
        fontWeightMedium: 500,
        fontWeightBold: 700,
        lineHeightBase: 1.5,
        lineHeightTight: 1.25,
        lineHeightRelaxed: 1.75
    },

    spacing: {
        // Match Hospeda's custom spacing scale (apps/web/tailwind.config.ts)
        xs: '0.5rem', // 8px - Hospeda xs
        sm: '0.75rem', // 12px - Hospeda sm
        md: '1rem', // 16px - Hospeda md
        lg: '1.5rem', // 24px - Hospeda lg
        xl: '2rem', // 32px - Hospeda xl
        xxl: '3rem' // 48px - Hospeda 2xl
    },

    borderRadius: {
        // Match Tailwind's default rounded-* utilities
        none: '0',
        sm: '0.25rem', // 4px - rounded-sm
        md: '0.5rem', // 8px - rounded-md (Hospeda default)
        lg: '0.75rem', // 12px - rounded-lg
        xl: '1rem', // 16px - rounded-xl
        full: '9999px' // rounded-full
    },

    shadows: {
        // Match Tailwind's shadow utilities
        none: 'none',
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)'
    },

    transitions: {
        // Match Hospeda's transition durations
        fast: '150ms',
        normal: '200ms',
        slow: '300ms',
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)' // ease-in-out
    }
});

/**
 * Dark mode theme variant for Hospeda
 *
 * Adjusts colors for dark mode while maintaining brand identity.
 * Uses brighter versions of primary colors for better contrast.
 */
export const hospedaQzpayDarkTheme: QZPayTheme = qzpayMergeTheme(hospedaQzpayTheme, {
    colors: {
        // Primary - Brighter teal for dark mode
        primary: '#2dd4bf', // primary-400
        primaryHover: '#5eead4', // primary-300
        primaryText: '#042f2e', // primary-950

        // Secondary - Brighter sky blue
        secondary: '#38bdf8', // secondary-400
        secondaryHover: '#7dd3fc', // secondary-300
        secondaryText: '#082f49', // secondary-950

        // Success
        success: '#2dd4bf', // primary-400
        successBackground: '#134e4a', // primary-900
        successText: '#5eead4', // primary-300

        // Warning - Brighter orange
        warning: '#f59332', // accent-400
        warningBackground: '#792f0f', // accent-900
        warningText: '#f8b86d', // accent-300

        // Error
        error: '#ef4444', // red-500
        errorBackground: '#7f1d1d', // red-900
        errorText: '#fca5a5', // red-300

        // Backgrounds - Dark mode
        background: '#111827', // gray-900
        surface: '#1f2937', // gray-800
        border: '#374151', // gray-700
        muted: '#6b7280', // gray-500

        // Text colors - Dark mode
        text: '#f9fafb', // gray-50
        textSecondary: '#9ca3af', // gray-400
        textDisabled: '#6b7280' // gray-500
    },

    shadows: {
        // Darker shadows for dark mode
        none: 'none',
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.2)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.3), 0 2px 4px -2px rgb(0 0 0 / 0.3)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.3), 0 4px 6px -4px rgb(0 0 0 / 0.3)'
    }
});
