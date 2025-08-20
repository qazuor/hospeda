import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * WebIcon component
 *
 * @example
 * ```tsx
 * import { WebIcon } from '@repo/icons';
 *
 * // Basic usage
 * <WebIcon />
 *
 * // With custom size and color
 * <WebIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <WebIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const WebIcon = ({
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
        aria-label={ariaLabel || 'web icon'}
        {...props}
    >
        <title>{ariaLabel || 'Web'}</title>
        <circle
            cx="12"
            cy="12"
            r="10"
        />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        <path d="M2 12h20" />
    </svg>
);
