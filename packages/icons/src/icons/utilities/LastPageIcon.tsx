import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * LastPageIcon icon component
 *
 * @example
 * ```tsx
 * import { LastPageIcon } from '@repo/icons';
 *
 * // Basic usage
 * <LastPageIcon />
 *
 * // With custom size and color
 * <LastPageIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <LastPageIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const LastPageIcon = ({
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
        <title>{ariaLabel || 'Last Page'}</title>
        <path d="m13 17 5-5-5-5" />
        <path d="m6 17 5-5-5-5" />
    </svg>
);
