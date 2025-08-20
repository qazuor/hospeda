import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * BlackoutCurtainsIcon icon component
 *
 * @example
 * ```tsx
 * import { BlackoutCurtainsIcon } from '@repo/icons';
 *
 * // Basic usage
 * <BlackoutCurtainsIcon />
 *
 * // With custom size and color
 * <BlackoutCurtainsIcon size="lg" color="#1F2937" />
 *
 * // With Tailwind classes
 * <BlackoutCurtainsIcon className="text-gray-800 hover:text-gray-900" />
 * ```
 */
export const BlackoutCurtainsIcon = ({
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
        <title>{ariaLabel || 'Blackout Curtains'}</title>
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        <path d="M2 2h20" />
        <path d="M4 4v16" />
        <path d="M8 4v16" />
        <path d="M12 4v16" />
        <path d="M16 4v16" />
        <path d="M20 4v16" />
        <path d="M2 22h20" />
    </svg>
);
