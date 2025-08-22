import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * ShareIcon icon component
 *
 * @example
 * ```tsx
 * import { ShareIcon } from '@repo/icons';
 *
 * // Basic usage
 * <ShareIcon />
 *
 * // With custom size and color
 * <ShareIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <ShareIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const ShareIcon = ({
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
        <title>{ariaLabel || 'Share'}</title>
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <polyline points="16,6 12,2 8,6" />
        <line
            x1="12"
            x2="12"
            y1="2"
            y2="15"
        />
    </svg>
);
