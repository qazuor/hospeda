import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * MinimalistStyleIcon icon component
 *
 * @example
 * ```tsx
 * import { MinimalistStyleIcon } from '@repo/icons';
 *
 * // Basic usage
 * <MinimalistStyleIcon />
 *
 * // With custom size and color
 * <MinimalistStyleIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <MinimalistStyleIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const MinimalistStyleIcon = ({
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
        <title>{ariaLabel || 'Minimalist Style'}</title>
        <path d="M8 3v3a2 2 0 0 1-2 2H3" />
        <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
        <path d="M3 16h3a2 2 0 0 1 2 2v3" />
        <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
    </svg>
);
