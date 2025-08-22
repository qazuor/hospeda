import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * KidsGamesIcon icon component
 *
 * @example
 * ```tsx
 * import { KidsGamesIcon } from '@repo/icons';
 *
 * // Basic usage
 * <KidsGamesIcon />
 *
 * // With custom size and color
 * <KidsGamesIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <KidsGamesIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const KidsGamesIcon = ({
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
        <title>{ariaLabel || 'Kids Games'}</title>
        <path d="M9 12h.01" />
        <path d="M15 12h.01" />
        <path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" />
        <path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1" />
    </svg>
);
