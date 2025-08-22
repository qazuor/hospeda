import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * BallroomIcon icon component
 *
 * @example
 * ```tsx
 * import { BallroomIcon } from '@repo/icons';
 *
 * // Basic usage
 * <BallroomIcon />
 *
 * // With custom size and color
 * <BallroomIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <BallroomIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const BallroomIcon = ({
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
        <title>{ariaLabel || 'Ballroom'}</title>
        <path d="M9 18V5l12-2v13" />
        <circle
            cx="6"
            cy="18"
            r="3"
        />
        <circle
            cx="18"
            cy="16"
            r="3"
        />
    </svg>
);
