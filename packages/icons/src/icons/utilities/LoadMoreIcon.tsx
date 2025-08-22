import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * LoadMoreIcon icon component
 *
 * @example
 * ```tsx
 * import { LoadMoreIcon } from '@repo/icons';
 *
 * // Basic usage
 * <LoadMoreIcon />
 *
 * // With custom size and color
 * <LoadMoreIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <LoadMoreIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const LoadMoreIcon = ({
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
        <title>{ariaLabel || 'Load More'}</title>
        <path d="m6 9 6 6 6-6" />
    </svg>
);
