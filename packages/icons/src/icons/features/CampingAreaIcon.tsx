import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * CampingAreaIcon icon component
 *
 * @example
 * ```tsx
 * import { CampingAreaIcon } from '@repo/icons';
 *
 * // Basic usage
 * <CampingAreaIcon />
 *
 * // With custom size and color
 * <CampingAreaIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <CampingAreaIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const CampingAreaIcon = ({
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
        <title>{ariaLabel || 'Camping Area'}</title>
        <path d="M3.5 21 14 3l10.5 18H3.5Z" />
        <path d="M12 13.5 7.5 21" />
        <path d="M12 13.5 16.5 21" />
    </svg>
);
