import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * GamingPlazaIcon icon component
 *
 * @example
 * ```tsx
 * import { GamingPlazaIcon } from '@repo/icons';
 *
 * // Basic usage
 * <GamingPlazaIcon />
 *
 * // With custom size and color
 * <GamingPlazaIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <GamingPlazaIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const GamingPlazaIcon = ({
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
        <title>{ariaLabel || 'Gaming Plaza'}</title>
        <line
            x1="6"
            x2="10"
            y1="12"
            y2="12"
        />
        <line
            x1="8"
            x2="8"
            y1="10"
            y2="14"
        />
        <line
            x1="15"
            x2="15.01"
            y1="13"
            y2="13"
        />
        <line
            x1="18"
            x2="18.01"
            y1="11"
            y2="11"
        />
        <rect
            width="20"
            height="12"
            x="2"
            y="6"
            rx="2"
        />
    </svg>
);
