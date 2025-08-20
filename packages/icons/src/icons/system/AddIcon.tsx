import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * AddIcon icon component
 *
 * @example
 * ```tsx
 * import { AddIcon } from '@repo/icons';
 *
 * // Basic usage
 * <AddIcon />
 *
 * // With custom size and color
 * <AddIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <AddIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const AddIcon = ({
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
        <title>{ariaLabel || 'Add'}</title>
        <path d="M5 12h14" />
        <path d="M12 5v14" />
    </svg>
);
