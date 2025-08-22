import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * EditIcon icon component
 *
 * @example
 * ```tsx
 * import { EditIcon } from '@repo/icons';
 *
 * // Basic usage
 * <EditIcon />
 *
 * // With custom size and color
 * <EditIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <EditIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const EditIcon = ({
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
        <title>{ariaLabel || 'Edit'}</title>
        <path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" />
        <path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z" />
        <path d="M16 5l3 3" />
    </svg>
);
