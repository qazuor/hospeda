/**
 * Phosphor-aligned icon weight system.
 * Controls the visual weight/style of the icon.
 *
 * - thin: Thinnest stroke weight
 * - light: Light stroke weight
 * - regular: Default stroke weight
 * - bold: Bold stroke weight
 * - fill: Filled/solid variant
 * - duotone: Two-tone variant with primary and secondary colors
 */
export type IconWeight = 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';

/**
 * Default color used for duotone weight icons.
 */
export const DEFAULT_DUOTONE_COLOR = '#1A5FB4';

/**
 * Base props for all icon components.
 * Designed for Phosphor Icons with duotone as the default weight.
 */
export interface IconProps {
    /**
     * Icon size - can be a number (pixels) or predefined size key
     * @default 'md' (24px)
     */
    size?: number | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

    /**
     * Icon color - accepts any valid CSS color value.
     * Used for all non-duotone weights.
     * @default 'currentColor'
     */
    color?: string;

    /**
     * Icon weight/style variant.
     * @default 'duotone'
     */
    weight?: IconWeight;

    /**
     * Color used when weight is 'duotone'.
     * Phosphor renders duotone with a primary layer at full opacity
     * and a secondary layer at 20% opacity, both using this color.
     * @default '#1A5FB4'
     */
    duotoneColor?: string;

    /**
     * Flip icon horizontally. Useful for RTL layouts.
     * @default false
     */
    mirrored?: boolean;

    /**
     * Additional CSS classes to apply to the icon
     */
    className?: string;

    /**
     * Accessibility label for screen readers
     */
    'aria-label'?: string;

    /**
     * Additional SVG props (onClick, onMouseOver, style, etc.)
     */
    [key: string]: unknown;
}

/**
 * Size mapping for predefined icon sizes
 */
export const ICON_SIZES = {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 28,
    xl: 32
} as const;
