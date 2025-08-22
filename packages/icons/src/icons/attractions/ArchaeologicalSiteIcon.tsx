import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * ArchaeologicalSiteIcon icon component
 *
 * @example
 * ```tsx
 * import { ArchaeologicalSiteIcon } from '@repo/icons';
 *
 * // Basic usage
 * <ArchaeologicalSiteIcon />
 *
 * // With custom size and color
 * <ArchaeologicalSiteIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <ArchaeologicalSiteIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const ArchaeologicalSiteIcon = ({
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
        <title>{ariaLabel || 'Archaeological Site'}</title>
        <path d="M14.531 12.469 6.619 20.38a1 1 0 1 1-1.414-1.414l7.912-7.912" />
        <path d="M15.686 4.314A12.5 12.5 0 0 0 5.461 2.958 1 1 0 0 0 5.58 4.71a22 22 0 0 1 6.318.52 3.108 3.108 0 0 0 3.15-1.6.3.3 0 0 0 0-.6c-1.815.04-3.595.257-5.284.681a1 1 0 0 0 .39 1.962 2.084 2.084 0 0 1 .454-.054 8.006 8.006 0 0 1 5.057 1.95" />
        <path d="m6.158 3.054 5.759 14.987a1 1 0 0 0 1.87-.546l-2.457-7.99" />
    </svg>
);
