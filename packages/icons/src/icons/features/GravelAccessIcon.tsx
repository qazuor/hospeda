import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * GravelAccessIcon icon component
 *
 * @example
 * ```tsx
 * import { GravelAccessIcon } from '@repo/icons';
 *
 * // Basic usage
 * <GravelAccessIcon />
 *
 * // With custom size and color
 * <GravelAccessIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <GravelAccessIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const GravelAccessIcon = ({
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
        <title>{ariaLabel || 'Gravel Access'}</title>
        <path d="m8 3 4 8 5-5v7H6V6l2-3z" />
        <path d="M4.14 11.73c.5-.5 1.36-.5 1.86 0l.5.5c.5.5 1.36.5 1.86 0l.5-.5c.5-.5 1.36-.5 1.86 0l.5.5c.5.5 1.36.5 1.86 0l.5-.5c.5-.5 1.36-.5 1.86 0l.5.5c.5.5 1.36.5 1.86 0l.5-.5c.5-.5 1.36-.5 1.86 0" />
    </svg>
);
