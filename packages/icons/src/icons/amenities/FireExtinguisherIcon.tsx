import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * FireExtinguisherIcon icon component
 *
 * @example
 * ```tsx
 * import { FireExtinguisherIcon } from '@repo/icons';
 *
 * // Basic usage
 * <FireExtinguisherIcon />
 *
 * // With custom size and color
 * <FireExtinguisherIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <FireExtinguisherIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const FireExtinguisherIcon = ({
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
        <title>{ariaLabel || 'Fire Extinguisher'}</title>
        <path d="M15 6.5V3a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v3.5" />
        <path d="M9 18h8" />
        <path d="M18 3h-3" />
        <path d="M11 3a6 6 0 0 0-6 6v11c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V9a6 6 0 0 0-6-6Z" />
        <path d="M12 8v4" />
        <path d="M12 16v1" />
    </svg>
);
