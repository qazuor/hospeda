import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * ViewAllIcon icon component
 *
 * @example
 * ```tsx
 * import { ViewAllIcon } from '@repo/icons';
 *
 * // Basic usage
 * <ViewAllIcon />
 *
 * // With custom size and color
 * <ViewAllIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <ViewAllIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const ViewAllIcon = ({
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
        <title>{ariaLabel || 'Viewall'}</title>
        <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
        <circle
            cx="12"
            cy="12"
            r="3"
        />
    </svg>
);
