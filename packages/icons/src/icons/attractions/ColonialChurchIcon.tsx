import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * ColonialChurchIcon icon component
 *
 * @example
 * ```tsx
 * import { ColonialChurchIcon } from '@repo/icons';
 *
 * // Basic usage
 * <ColonialChurchIcon />
 *
 * // With custom size and color
 * <ColonialChurchIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <ColonialChurchIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const ColonialChurchIcon = ({
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
        <title>{ariaLabel || 'Colonial Church'}</title>
        <path d="m18 7 4 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9l4-2" />
        <path d="M14 22v-4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4" />
        <path d="M18 22V5l-6-3-6 3v17" />
        <path d="M12 7v5" />
        <path d="M10 9h4" />
    </svg>
);
