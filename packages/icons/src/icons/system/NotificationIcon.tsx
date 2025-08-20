import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * NotificationIcon icon component
 *
 * @example
 * ```tsx
 * import { NotificationIcon } from '@repo/icons';
 *
 * // Basic usage
 * <NotificationIcon />
 *
 * // With custom size and color
 * <NotificationIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <NotificationIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const NotificationIcon = ({
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
        <title>{ariaLabel || 'Notification'}</title>
        <path d="M10.268 21a2 2 0 0 0 3.464 0" />
        <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
    </svg>
);
