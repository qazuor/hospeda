import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * LuggageStorageIcon icon component
 *
 * @example
 * ```tsx
 * import { LuggageStorageIcon } from '@repo/icons';
 *
 * // Basic usage
 * <LuggageStorageIcon />
 *
 * // With custom size and color
 * <LuggageStorageIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <LuggageStorageIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const LuggageStorageIcon = ({
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
        <title>{ariaLabel || 'Luggage Storage'}</title>
        <path d="M6 20a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2" />
        <path d="M8 18V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14" />
        <path d="M10 20h4" />
        <circle
            cx="16"
            cy="20"
            r="2"
        />
        <circle
            cx="8"
            cy="20"
            r="2"
        />
    </svg>
);
