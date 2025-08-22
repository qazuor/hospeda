import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * LoaderIcon icon component with spinning animation
 *
 * @example
 * ```tsx
 * import { LoaderIcon } from '@repo/icons';
 *
 * // Basic usage
 * <LoaderIcon />
 *
 * // With custom size and color
 * <LoaderIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <LoaderIcon className="text-blue-500" />
 * ```
 */
export const LoaderIcon = ({
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
        className={`animate-spin ${className}`}
        aria-label={ariaLabel}
        {...props}
    >
        <title>{ariaLabel || 'Loading'}</title>
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
    </svg>
);
