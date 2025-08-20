import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * ConfirmedIcon icon component
 *
 * @example
 * ```tsx
 * import { ConfirmedIcon } from '@repo/icons';
 *
 * // Basic usage
 * <ConfirmedIcon />
 *
 * // With custom size and color
 * <ConfirmedIcon size="lg" color="#10B981" />
 *
 * // With Tailwind classes
 * <ConfirmedIcon className="text-green-500 hover:text-green-600" />
 * ```
 */
export const ConfirmedIcon = ({
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
        <title>{ariaLabel || 'Confirmed'}</title>
        <path d="M20 6 9 17l-5-5" />
    </svg>
);
