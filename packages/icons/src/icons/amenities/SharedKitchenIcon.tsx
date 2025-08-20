import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * SharedKitchenIcon icon component
 *
 * @example
 * ```tsx
 * import { SharedKitchenIcon } from '@repo/icons';
 *
 * // Basic usage
 * <SharedKitchenIcon />
 *
 * // With custom size and color
 * <SharedKitchenIcon size="lg" color="#8B5CF6" />
 *
 * // With Tailwind classes
 * <SharedKitchenIcon className="text-purple-500 hover:text-purple-600" />
 * ```
 */
export const SharedKitchenIcon = ({
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
        <title>{ariaLabel || 'Shared Kitchen'}</title>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle
            cx="9"
            cy="7"
            r="4"
        />
        <path d="m22 21-3-3" />
        <path d="m15 18 3 3" />
        <rect
            width="8"
            height="6"
            x="2"
            y="3"
            rx="1"
        />
        <path d="M6 8V6" />
        <path d="M10 8V6" />
        <path d="M4 11h8" />
    </svg>
);
