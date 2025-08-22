import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * ProfessionalStaffIcon icon component
 *
 * @example
 * ```tsx
 * import { ProfessionalStaffIcon } from '@repo/icons';
 *
 * // Basic usage
 * <ProfessionalStaffIcon />
 *
 * // With custom size and color
 * <ProfessionalStaffIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <ProfessionalStaffIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const ProfessionalStaffIcon = ({
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
        <title>{ariaLabel || 'Professional Staff'}</title>
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle
            cx="8.5"
            cy="7"
            r="4"
        />
        <path d="m17 11 2 2 4-4" />
    </svg>
);
