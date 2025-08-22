import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * SolarShowersIcon icon component
 *
 * @example
 * ```tsx
 * import { SolarShowersIcon } from '@repo/icons';
 *
 * // Basic usage
 * <SolarShowersIcon />
 *
 * // With custom size and color
 * <SolarShowersIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <SolarShowersIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const SolarShowersIcon = ({
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
        <title>{ariaLabel || 'Solar Showers'}</title>
        <circle
            cx="12"
            cy="4"
            r="2"
        />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="m6.34 17.66-1.41 1.41" />
        <path d="m19.07 4.93-1.41 1.41" />
    </svg>
);
