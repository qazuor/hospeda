import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * AdultsOnlyIcon icon component
 *
 * @example
 * ```tsx
 * import { AdultsOnlyIcon } from '@repo/icons';
 *
 * // Basic usage
 * <AdultsOnlyIcon />
 *
 * // With custom size and color
 * <AdultsOnlyIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <AdultsOnlyIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const AdultsOnlyIcon = ({
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
        <title>{ariaLabel || 'Adults Only'}</title>
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle
            cx="8.5"
            cy="7"
            r="4"
        />
        <path d="m17 11 5 5" />
        <path d="m22 11-5 5" />
    </svg>
);
