import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * CopyIcon component
 *
 * @example
 * ```tsx
 * import { CopyIcon } from '@repo/icons';
 *
 * // Basic usage
 * <CopyIcon />
 *
 * // With custom size and color
 * <CopyIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <CopyIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const CopyIcon = ({
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
        aria-label={ariaLabel || 'copy icon'}
        {...props}
    >
        <title>{ariaLabel || 'Copy'}</title>
        <rect
            width="14"
            height="14"
            x="8"
            y="8"
            rx="2"
            ry="2"
        />
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
);
