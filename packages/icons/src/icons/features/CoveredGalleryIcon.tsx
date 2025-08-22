import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * CoveredGalleryIcon icon component
 *
 * @example
 * ```tsx
 * import { CoveredGalleryIcon } from '@repo/icons';
 *
 * // Basic usage
 * <CoveredGalleryIcon />
 *
 * // With custom size and color
 * <CoveredGalleryIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <CoveredGalleryIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const CoveredGalleryIcon = ({
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
        <title>{ariaLabel || 'Covered Gallery'}</title>
        <rect
            width="16"
            height="20"
            x="4"
            y="2"
            rx="2"
            ry="2"
        />
        <path d="M9 22v-4h6v4" />
        <path d="M8 6h.01" />
        <path d="M16 6h.01" />
        <path d="M12 6h.01" />
        <path d="M12 10h.01" />
        <path d="M12 14h.01" />
        <path d="M16 10h.01" />
        <path d="M16 14h.01" />
        <path d="M8 10h.01" />
        <path d="M8 14h.01" />
    </svg>
);
