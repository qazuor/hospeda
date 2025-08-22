import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * WorkshopSpaceIcon icon component
 *
 * @example
 * ```tsx
 * import { WorkshopSpaceIcon } from '@repo/icons';
 *
 * // Basic usage
 * <WorkshopSpaceIcon />
 *
 * // With custom size and color
 * <WorkshopSpaceIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <WorkshopSpaceIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const WorkshopSpaceIcon = ({
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
        <title>{ariaLabel || 'Workshop Space'}</title>
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
);
