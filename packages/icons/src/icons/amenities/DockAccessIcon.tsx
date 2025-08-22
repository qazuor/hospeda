import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * DockAccessIcon icon component
 *
 * @example
 * ```tsx
 * import { DockAccessIcon } from '@repo/icons';
 *
 * // Basic usage
 * <DockAccessIcon />
 *
 * // With custom size and color
 * <DockAccessIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <DockAccessIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const DockAccessIcon = ({
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
        <title>{ariaLabel || 'Dock Access'}</title>
        <circle
            cx="12"
            cy="5"
            r="3"
        />
        <path d="m2 12 7-7 3 3 3-3 7 7" />
        <path d="M5 19h14" />
    </svg>
);
