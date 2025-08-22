import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * AudioIcon icon component
 *
 * @example
 * ```tsx
 * import { AudioIcon } from '@repo/icons';
 *
 * // Basic usage
 * <AudioIcon />
 *
 * // With custom size and color
 * <AudioIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <AudioIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const AudioIcon = ({
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
        <title>{ariaLabel || 'Audio'}</title>
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
);
