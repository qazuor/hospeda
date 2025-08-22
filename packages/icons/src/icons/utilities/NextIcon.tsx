import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * NextIcon icon component
 *
 * @example
 * ```tsx
 * import { NextIcon } from '@repo/icons';
 *
 * // Basic usage
 * <NextIcon />
 *
 * // With custom size and color
 * <NextIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <NextIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const NextIcon = ({
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
        <title>{ariaLabel || 'Next'}</title>
        <path d="m9 18 6-6-6-6" />
    </svg>
);
