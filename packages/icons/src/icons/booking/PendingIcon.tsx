import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * PendingIcon icon component
 *
 * @example
 * ```tsx
 * import { PendingIcon } from '@repo/icons';
 *
 * // Basic usage
 * <PendingIcon />
 *
 * // With custom size and color
 * <PendingIcon size="lg" color="#F59E0B" />
 *
 * // With Tailwind classes
 * <PendingIcon className="text-yellow-500 hover:text-yellow-600" />
 * ```
 */
export const PendingIcon = ({
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
        <title>{ariaLabel || 'Pending'}</title>
        <circle
            cx="12"
            cy="12"
            r="10"
        />
        <polyline points="12,6 12,12 16,14" />
    </svg>
);
