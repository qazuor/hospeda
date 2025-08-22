import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * DeleteIcon icon component
 *
 * @example
 * ```tsx
 * import { DeleteIcon } from '@repo/icons';
 *
 * // Basic usage
 * <DeleteIcon />
 *
 * // With custom size and color
 * <DeleteIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <DeleteIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const DeleteIcon = ({
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
        <title>{ariaLabel || 'Delete'}</title>
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c0-1 1-2 2-2v2" />
    </svg>
);
