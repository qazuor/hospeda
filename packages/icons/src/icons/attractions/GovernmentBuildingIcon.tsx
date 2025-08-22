import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * GovernmentBuildingIcon icon component
 *
 * @example
 * ```tsx
 * import { GovernmentBuildingIcon } from '@repo/icons';
 *
 * // Basic usage
 * <GovernmentBuildingIcon />
 *
 * // With custom size and color
 * <GovernmentBuildingIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <GovernmentBuildingIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const GovernmentBuildingIcon = ({
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
        <title>{ariaLabel || 'Government Building'}</title>
        <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
        <path d="M6 12H4a2 2 0 0 0-2 2v8h20v-8a2 2 0 0 0-2-2h-2" />
        <path d="M10 6h.01" />
        <path d="M14 6h.01" />
        <path d="M10 10h.01" />
        <path d="M14 10h.01" />
        <path d="M10 14h.01" />
        <path d="M14 14h.01" />
        <path d="M10 18h.01" />
        <path d="M14 18h.01" />
    </svg>
);
