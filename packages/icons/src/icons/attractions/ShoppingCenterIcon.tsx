import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * ShoppingCenterIcon icon component
 *
 * @example
 * ```tsx
 * import { ShoppingCenterIcon } from '@repo/icons';
 *
 * // Basic usage
 * <ShoppingCenterIcon />
 *
 * // With custom size and color
 * <ShoppingCenterIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <ShoppingCenterIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const ShoppingCenterIcon = ({
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
        <title>{ariaLabel || 'Shoppingcenter'}</title>
        <path d="M16 10a4 4 0 0 1-8 0" />
        <path d="M3.103 6.034h17.794" />
        <path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z" />
    </svg>
);
