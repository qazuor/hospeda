import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * PerimeterLightingIcon icon component
 *
 * @example
 * ```tsx
 * import { PerimeterLightingIcon } from '@repo/icons';
 *
 * // Basic usage
 * <PerimeterLightingIcon />
 *
 * // With custom size and color
 * <PerimeterLightingIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <PerimeterLightingIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const PerimeterLightingIcon = ({
    size = 'md',
    color = 'currentColor',
    className = '',
    'aria-label': ariaLabel,
    ...props
}: IconProps) => (
    <svg
        width={typeof size === 'string' ? ICON_SIZES[size] : size}
        height={typeof size === 'string' ? ICON_SIZES[size] : size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-label={ariaLabel}
        {...props}
    >
        <title>{ariaLabel || 'Perimeter Lighting'}</title>
        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
        <path d="M9 18h6" />
        <path d="M10 22h4" />
    </svg>
);
