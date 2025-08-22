import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * RecreationalBoatingIcon icon component
 *
 * @example
 * ```tsx
 * import { RecreationalBoatingIcon } from '@repo/icons';
 *
 * // Basic usage
 * <RecreationalBoatingIcon />
 *
 * // With custom size and color
 * <RecreationalBoatingIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <RecreationalBoatingIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const RecreationalBoatingIcon = ({
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
        <title>{ariaLabel || 'Recreational Boating'}</title>
        <path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2Z" />
        <path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5" />
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1" />
    </svg>
);
