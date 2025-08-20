import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * WifiIcon icon component
 *
 * @example
 * ```tsx
 * import { WifiIcon } from '@repo/icons';
 *
 * // Basic usage
 * <WifiIcon />
 *
 * // With custom size and color
 * <WifiIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <WifiIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const WifiIcon = ({
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
        <title>{ariaLabel || 'Wifi'}</title>
        <path d="M12 20h.01" />
        <path d="M2 8.82a15 15 0 0 1 20 0" />
        <path d="M5 12.859a10 10 0 0 1 14 0" />
        <path d="M8.5 16.429a5 5 0 0 1 7 0" />
    </svg>
);
