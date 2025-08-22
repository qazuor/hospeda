import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * PromotionsIcon icon component
 *
 * @example
 * ```tsx
 * import { PromotionsIcon } from '@repo/icons';
 *
 * // Basic usage
 * <PromotionsIcon />
 *
 * // With custom size and color
 * <PromotionsIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <PromotionsIcon className="text-red-500 hover:text-red-600" />
 * ```
 */
export const PromotionsIcon = ({
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
        <title>{ariaLabel || 'Promotions'}</title>
        <circle
            cx="12"
            cy="12"
            r="10"
        />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
    </svg>
);
