import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * QuietEnvironmentIcon icon component
 *
 * @example
 * ```tsx
 * import { QuietEnvironmentIcon } from '@repo/icons';
 *
 * // Basic usage
 * <QuietEnvironmentIcon />
 *
 * // With custom size and color
 * <QuietEnvironmentIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <QuietEnvironmentIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const QuietEnvironmentIcon = ({
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
        <title>{ariaLabel || 'Quiet Environment'}</title>
        <path d="M16 9a5 5 0 0 1-5 5 5 5 0 0 1-5-5V7a5 5 0 0 1 5-5 5 5 0 0 1 5 5z" />
        <path d="M8 21H5a2 2 0 0 1-2-2v-1c0-1.1.9-2 2-2h3m8 5h3a2 2 0 0 0 2-2v-1c0-1.1-.9-2-2-2h-3" />
        <path d="M12 17v4" />
        <path d="m2 2 20 20" />
    </svg>
);
