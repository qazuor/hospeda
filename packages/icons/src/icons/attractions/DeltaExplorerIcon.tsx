import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * DeltaExplorerIcon icon component
 *
 * @example
 * ```tsx
 * import { DeltaExplorerIcon } from '@repo/icons';
 *
 * // Basic usage
 * <DeltaExplorerIcon />
 *
 * // With custom size and color
 * <DeltaExplorerIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <DeltaExplorerIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const DeltaExplorerIcon = ({
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
        <title>{ariaLabel || 'Delta Explorer'}</title>
        <path d="m3 11 19-9" />
        <path d="m11 12-3-3 3-3" />
        <path d="m16 16 3 3-3 3" />
    </svg>
);
