import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * PreviousIcon icon component
 *
 * @example
 * ```tsx
 * import { PreviousIcon } from '@repo/icons';
 *
 * // Basic usage
 * <PreviousIcon />
 *
 * // With custom size and color
 * <PreviousIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <PreviousIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const PreviousIcon = ({
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
        <title>{ariaLabel || 'Previous'}</title>
        <path d="m15 18-6-6 6-6" />
    </svg>
);
