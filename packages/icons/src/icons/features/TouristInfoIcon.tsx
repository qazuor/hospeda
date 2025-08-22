import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * TouristInfoIcon icon component
 *
 * @example
 * ```tsx
 * import { TouristInfoIcon } from '@repo/icons';
 *
 * // Basic usage
 * <TouristInfoIcon />
 *
 * // With custom size and color
 * <TouristInfoIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <TouristInfoIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const TouristInfoIcon = ({
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
        <title>{ariaLabel || 'Tourist Info'}</title>
        <circle
            cx="12"
            cy="12"
            r="10"
        />
        <path d="m9 12 2 2 4-4" />
    </svg>
);
