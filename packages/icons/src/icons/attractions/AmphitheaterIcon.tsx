import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * AmphitheaterIcon icon component
 *
 * @example
 * ```tsx
 * import { AmphitheaterIcon } from '@repo/icons';
 *
 * // Basic usage
 * <AmphitheaterIcon />
 *
 * // With custom size and color
 * <AmphitheaterIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <AmphitheaterIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const AmphitheaterIcon = ({
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
        <title>{ariaLabel || 'Amphitheater'}</title>
        <path d="M2 10s3-3 3-8" />
        <path d="M22 10s-3-3-3-8" />
        <path d="M10 2c0 4.4-3.6 8-8 8" />
        <path d="M14 2c0 4.4 3.6 8 8 8" />
        <path d="M2 10s2 2 2 5" />
        <path d="M22 10s-2 2-2 5" />
        <path d="M8 15h8" />
        <path d="M2 22v-1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1" />
        <path d="M14 22v-1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1" />
    </svg>
);
