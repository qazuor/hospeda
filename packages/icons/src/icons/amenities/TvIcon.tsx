import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * TvIcon icon component
 *
 * @example
 * ```tsx
 * import { TvIcon } from '@repo/icons';
 *
 * // Basic usage
 * <TvIcon />
 *
 * // With custom size and color
 * <TvIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <TvIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const TvIcon = ({
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
        <title>{ariaLabel || 'Tv'}</title>
        <path d="m17 2-5 5-5-5" />
        <rect
            width="20"
            height="15"
            x="2"
            y="7"
            rx="2"
        />
    </svg>
);
