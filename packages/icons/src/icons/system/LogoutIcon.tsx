import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * LogoutIcon icon component
 *
 * @example
 * ```tsx
 * import { LogoutIcon } from '@repo/icons';
 *
 * // Basic usage
 * <LogoutIcon />
 *
 * // With custom size and color
 * <LogoutIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <LogoutIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const LogoutIcon = ({
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
        <title>{ariaLabel || 'Logout'}</title>
        <path d="m16 17 5-5-5-5" />
        <path d="M21 12H9" />
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    </svg>
);
