import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * CreateIcon icon component
 *
 * @example
 * ```tsx
 * import { CreateIcon } from '@repo/icons';
 *
 * // Basic usage
 * <CreateIcon />
 *
 * // With custom size and color
 * <CreateIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <CreateIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const CreateIcon = ({
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
        <title>{ariaLabel || 'Create'}</title>
        <circle
            cx="12"
            cy="12"
            r="10"
        />
        <path d="M8 12h8" />
        <path d="M12 8v8" />
    </svg>
);
