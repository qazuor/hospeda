import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * SportFishingIcon icon component
 *
 * @example
 * ```tsx
 * import { SportFishingIcon } from '@repo/icons';
 *
 * // Basic usage
 * <SportFishingIcon />
 *
 * // With custom size and color
 * <SportFishingIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <SportFishingIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const SportFishingIcon = ({
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
        <title>{ariaLabel || 'Sport Fishing'}</title>
        <path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z" />
        <path d="M18 12v.5" />
        <path d="M16 17.93a9.77 9.77 0 0 1 0 0 1.5 1.5 0 0 0-1 0c-.26.26-.6.42-1 .42s-.74-.16-1-.42a1.5 1.5 0 0 0-1 0 9.77 9.77 0 0 1 0 0 1.5 1.5 0 0 0-1 0C10.74 18.16 10.4 18 10 18s-.74.16-1 .42a1.5 1.5 0 0 0-1 0 9.77 9.77 0 0 1 0 0" />
    </svg>
);
