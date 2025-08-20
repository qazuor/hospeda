import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * FavoriteIcon icon component
 *
 * @example
 * ```tsx
 * import { FavoriteIcon } from '@repo/icons';
 *
 * // Basic usage
 * <FavoriteIcon />
 *
 * // With custom size and color
 * <FavoriteIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <FavoriteIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const FavoriteIcon = ({
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
        <title>{ariaLabel || 'Favorite'}</title>
        <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
    </svg>
);
