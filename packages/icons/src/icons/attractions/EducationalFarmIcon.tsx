import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * EducationalFarmIcon icon component
 *
 * @example
 * ```tsx
 * import { EducationalFarmIcon } from '@repo/icons';
 *
 * // Basic usage
 * <EducationalFarmIcon />
 *
 * // With custom size and color
 * <EducationalFarmIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <EducationalFarmIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const EducationalFarmIcon = ({
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
        <title>{ariaLabel || 'Educationalfarm'}</title>
        <path d="m10 11 11 .9a1 1 0 0 1 .8 1.1l-.665 4.158a1 1 0 0 1-.988.842H20" />
        <path d="M16 18h-5" />
        <path d="M18 5a1 1 0 0 0-1 1v5.573" />
        <path d="M3 4h8.129a1 1 0 0 1 .99.863L13 11.246" />
        <path d="M4 11V4" />
        <path d="M7 15h.01" />
        <path d="M8 10.1V4" />
        <circle
            cx="18"
            cy="18"
            r="2"
        />
        <circle
            cx="7"
            cy="15"
            r="5"
        />
    </svg>
);
