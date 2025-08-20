import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * InstagramIcon component
 *
 * @example
 * ```tsx
 * import { InstagramIcon } from '@repo/icons';
 *
 * // Basic usage
 * <InstagramIcon />
 *
 * // With custom size and color
 * <InstagramIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <InstagramIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const InstagramIcon = ({
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
        aria-label={ariaLabel || 'instagram icon'}
        {...props}
    >
        <title>{ariaLabel || 'Instagram'}</title>
        <rect
            width="20"
            height="20"
            x="2"
            y="2"
            rx="5"
            ry="5"
        />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line
            x1="17.5"
            x2="17.51"
            y1="6.5"
            y2="6.5"
        />
    </svg>
);
