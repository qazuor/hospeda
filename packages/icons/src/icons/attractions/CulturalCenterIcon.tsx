import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * CulturalCenterIcon icon component
 *
 * @example
 * ```tsx
 * import { CulturalCenterIcon } from '@repo/icons';
 *
 * // Basic usage
 * <CulturalCenterIcon />
 *
 * // With custom size and color
 * <CulturalCenterIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <CulturalCenterIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const CulturalCenterIcon = ({
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
        <title>{ariaLabel || 'Culturalcenter'}</title>
        <path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" />
        <circle
            cx="13.5"
            cy="6.5"
            r=".5"
            fill="currentColor"
        />
        <circle
            cx="17.5"
            cy="10.5"
            r=".5"
            fill="currentColor"
        />
        <circle
            cx="6.5"
            cy="12.5"
            r=".5"
            fill="currentColor"
        />
        <circle
            cx="8.5"
            cy="7.5"
            r=".5"
            fill="currentColor"
        />
    </svg>
);
