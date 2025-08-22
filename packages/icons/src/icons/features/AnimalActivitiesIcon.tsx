import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * AnimalActivitiesIcon icon component
 *
 * @example
 * ```tsx
 * import { AnimalActivitiesIcon } from '@repo/icons';
 *
 * // Basic usage
 * <AnimalActivitiesIcon />
 *
 * // With custom size and color
 * <AnimalActivitiesIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <AnimalActivitiesIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const AnimalActivitiesIcon = ({
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
        <title>{ariaLabel || 'Animal Activities'}</title>
        <path d="M4 11a7 7 0 0 1 14 0v3a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6Z" />
        <path d="M12 2v9" />
        <path d="m8 10-1.5-1.5" />
        <path d="m16 10 1.5-1.5" />
    </svg>
);
