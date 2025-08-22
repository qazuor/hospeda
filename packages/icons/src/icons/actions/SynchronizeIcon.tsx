import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * SynchronizeIcon icon component
 *
 * @example
 * ```tsx
 * import { SynchronizeIcon } from '@repo/icons';
 *
 * // Basic usage
 * <SynchronizeIcon />
 *
 * // With custom size and color
 * <SynchronizeIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <SynchronizeIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const SynchronizeIcon = ({
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
        <title>{ariaLabel || 'Synchronize'}</title>
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
        <path d="M8 16H3v5" />
    </svg>
);
