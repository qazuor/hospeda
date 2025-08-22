import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * CouponsIcon icon component
 *
 * @example
 * ```tsx
 * import { CouponsIcon } from '@repo/icons';
 *
 * // Basic usage
 * <CouponsIcon />
 *
 * // With custom size and color
 * <CouponsIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <CouponsIcon className="text-orange-500 hover:text-orange-600" />
 * ```
 */
export const CouponsIcon = ({
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
        <title>{ariaLabel || 'Coupons'}</title>
        <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
        <path d="M13 5v2" />
        <path d="M13 17v2" />
        <path d="M13 11v2" />
    </svg>
);
