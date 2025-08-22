import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * LogsIcon icon component
 *
 * @example
 * ```tsx
 * import { LogsIcon } from '@repo/icons';
 *
 * // Basic usage
 * <LogsIcon />
 *
 * // With custom size and color
 * <LogsIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <LogsIcon className="text-gray-500 hover:text-gray-600" />
 * ```
 */
export const LogsIcon = ({
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
        <title>{ariaLabel || 'Logs'}</title>
        <path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2c1 1 1 1 1 1h3s1 0 1 1v13z" />
        <path d="M19 17V5a2 2 0 0 0-2-2H4" />
        <path d="M8 7h8" />
        <path d="M8 11h5" />
    </svg>
);
