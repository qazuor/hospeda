import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * MiniBarIcon icon component
 *
 * @example
 * ```tsx
 * import { MiniBarIcon } from '@repo/icons';
 *
 * // Basic usage
 * <MiniBarIcon />
 *
 * // With custom size and color
 * <MiniBarIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <MiniBarIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const MiniBarIcon = ({
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
        <title>{ariaLabel || 'Minibar'}</title>
        <path d="M8 22h8" />
        <path d="M7 10h10" />
        <path d="M12 15v7" />
        <path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z" />
    </svg>
);
