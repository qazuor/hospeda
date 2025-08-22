import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * GastronomicMarketIcon icon component
 *
 * @example
 * ```tsx
 * import { GastronomicMarketIcon } from '@repo/icons';
 *
 * // Basic usage
 * <GastronomicMarketIcon />
 *
 * // With custom size and color
 * <GastronomicMarketIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <GastronomicMarketIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const GastronomicMarketIcon = ({
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
        <title>{ariaLabel || 'Gastronomic Market'}</title>
        <path d="M3 21h18" />
        <path d="M5 21V7l8-4v18" />
        <path d="M19 21V11l-6-4" />
    </svg>
);
