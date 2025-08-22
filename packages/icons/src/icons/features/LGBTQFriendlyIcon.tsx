import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * LGBTQFriendlyIcon icon component
 *
 * @example
 * ```tsx
 * import { LGBTQFriendlyIcon } from '@repo/icons';
 *
 * // Basic usage
 * <LGBTQFriendlyIcon />
 *
 * // With custom size and color
 * <LGBTQFriendlyIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <LGBTQFriendlyIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const LGBTQFriendlyIcon = ({
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
        <title>{ariaLabel || 'LGBTQ Friendly'}</title>
        <path d="M22 17a10 10 0 0 0-20 0" />
        <path d="M6 17a6 6 0 0 1 12 0" />
        <path d="M10 17a2 2 0 0 1 4 0" />
    </svg>
);
