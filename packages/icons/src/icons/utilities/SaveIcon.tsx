import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * SaveIcon icon component
 *
 * @example
 * ```tsx
 * import { SaveIcon } from '@repo/icons';
 *
 * // Basic usage
 * <SaveIcon />
 *
 * // With custom size and color
 * <SaveIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <SaveIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const SaveIcon = ({
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
        <title>{ariaLabel || 'Save'}</title>
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <polyline points="17,21 17,13 7,13 7,21" />
        <polyline points="7,3 7,8 15,8" />
    </svg>
);
