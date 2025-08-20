import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * WasherIcon icon component
 *
 * @example
 * ```tsx
 * import { WasherIcon } from '@repo/icons';
 *
 * // Basic usage
 * <WasherIcon />
 *
 * // With custom size and color
 * <WasherIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <WasherIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const WasherIcon = ({
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
        <title>{ariaLabel || 'Washer'}</title>
        <path d="M3 6h3" />
        <path d="M17 6h.01" />
        <rect
            width="18"
            height="20"
            x="3"
            y="2"
            rx="2"
        />
        <circle
            cx="12"
            cy="13"
            r="5"
        />
        <path d="M12 18a2.5 2.5 0 0 0 0-5 2.5 2.5 0 0 1 0-5" />
    </svg>
);
