import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * PriceIcon icon component
 *
 * @example
 * ```tsx
 * import { PriceIcon } from '@repo/icons';
 *
 * // Basic usage
 * <PriceIcon />
 *
 * // With custom size and color
 * <PriceIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <PriceIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const PriceIcon = ({
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
        <title>{ariaLabel || 'Price'}</title>
        <line
            x1="12"
            x2="12"
            y1="2"
            y2="22"
        />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
);
