import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * PrintIcon icon component
 *
 * @example
 * ```tsx
 * import { PrintIcon } from '@repo/icons';
 *
 * // Basic usage
 * <PrintIcon />
 *
 * // With custom size and color
 * <PrintIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <PrintIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const PrintIcon = ({
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
        <title>{ariaLabel || 'Print'}</title>
        <polyline points="6,9 6,2 18,2 18,9" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect
            width="12"
            height="8"
            x="6"
            y="14"
        />
    </svg>
);
