import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * ShoppingServiceIcon icon component
 *
 * @example
 * ```tsx
 * import { ShoppingServiceIcon } from '@repo/icons';
 *
 * // Basic usage
 * <ShoppingServiceIcon />
 *
 * // With custom size and color
 * <ShoppingServiceIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <ShoppingServiceIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const ShoppingServiceIcon = ({
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
        <title>{ariaLabel || 'Shopping Service'}</title>
        <circle
            cx="8"
            cy="21"
            r="1"
        />
        <circle
            cx="19"
            cy="21"
            r="1"
        />
        <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57L22.01 7H5.12" />
    </svg>
);
