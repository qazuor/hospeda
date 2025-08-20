import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * SmartHomeIcon icon component
 *
 * @example
 * ```tsx
 * import { SmartHomeIcon } from '@repo/icons';
 *
 * // Basic usage
 * <SmartHomeIcon />
 *
 * // With custom size and color
 * <SmartHomeIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <SmartHomeIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const SmartHomeIcon = ({
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
        <title>{ariaLabel || 'Smarthome'}</title>
        <rect
            width="14"
            height="20"
            x="5"
            y="2"
            rx="2"
            ry="2"
        />
        <path d="M12 18h.01" />
    </svg>
);
