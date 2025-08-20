/**
 * Base props for all icon components
 * Pure SVG component props without external dependencies
 */
export interface IconProps {
    /**
     * Icon size - can be a number (pixels) or predefined size
     * @default 24
     */
    size?: number | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

    /**
     * Icon color - accepts any valid CSS color value
     * @default 'currentColor'
     */
    color?: string;

    /**
     * Additional CSS classes to apply to the icon
     */
    className?: string;

    /**
     * Accessibility label for screen readers
     */
    'aria-label'?: string;

    /**
     * Additional SVG props (onClick, onMouseOver, etc.)
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
