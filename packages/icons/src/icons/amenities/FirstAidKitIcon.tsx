import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * FirstAidKitIcon icon component
 *
 * @example
 * ```tsx
 * import { FirstAidKitIcon } from '@repo/icons';
 *
 * // Basic usage
 * <FirstAidKitIcon />
 *
 * // With custom size and color
 * <FirstAidKitIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <FirstAidKitIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const FirstAidKitIcon = ({
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
        <title>{ariaLabel || 'First Aid Kit'}</title>
        <path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h5v5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z" />
    </svg>
);
