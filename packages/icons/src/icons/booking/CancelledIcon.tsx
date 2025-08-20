import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * CancelledIcon icon component
 *
 * @example
 * ```tsx
 * import { CancelledIcon } from '@repo/icons';
 *
 * // Basic usage
 * <CancelledIcon />
 *
 * // With custom size and color
 * <CancelledIcon size="lg" color="#EF4444" />
 *
 * // With Tailwind classes
 * <CancelledIcon className="text-red-500 hover:text-red-600" />
 * ```
 */
export const CancelledIcon = ({
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
        <title>{ariaLabel || 'Cancelled'}</title>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
    </svg>
);
