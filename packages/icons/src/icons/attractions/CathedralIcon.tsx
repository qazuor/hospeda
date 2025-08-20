import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * CathedralIcon icon component
 *
 * @example
 * ```tsx
 * import { CathedralIcon } from '@repo/icons';
 *
 * // Basic usage
 * <CathedralIcon />
 *
 * // With custom size and color
 * <CathedralIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <CathedralIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const CathedralIcon = ({
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
        <title>{ariaLabel || 'Cathedral'}</title>
        <path d="M10 9h4" />
        <path d="M12 7v5" />
        <path d="M14 22v-4a2 2 0 0 0-4 0v4" />
        <path d="M18 22V5.618a1 1 0 0 0-.553-.894l-4.553-2.277a2 2 0 0 0-1.788 0L6.553 4.724A1 1 0 0 0 6 5.618V22" />
        <path d="m18 7 3.447 1.724a1 1 0 0 1 .553.894V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9.618a1 1 0 0 1 .553-.894L6 7" />
    </svg>
);
