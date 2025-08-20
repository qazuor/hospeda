import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * SettingsIcon component
 *
 * @example
 * ```tsx
 * import { SettingsIcon } from '@repo/icons';
 *
 * // Basic usage
 * <SettingsIcon />
 *
 * // With custom size and color
 * <SettingsIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <SettingsIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const SettingsIcon = ({
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
        aria-label={ariaLabel || 'settings icon'}
        {...props}
    >
        <title>{ariaLabel || 'Settings'}</title>
        <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
        <circle
            cx="12"
            cy="12"
            r="3"
        />
    </svg>
);
