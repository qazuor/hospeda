import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * ExportIcon icon component
 *
 * @example
 * ```tsx
 * import { ExportIcon } from '@repo/icons';
 *
 * // Basic usage
 * <ExportIcon />
 *
 * // With custom size and color
 * <ExportIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <ExportIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const ExportIcon = ({
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
        <title>{ariaLabel || 'Export'}</title>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7,10 12,15 17,10" />
        <line
            x1="12"
            x2="12"
            y1="15"
            y2="3"
        />
    </svg>
);
