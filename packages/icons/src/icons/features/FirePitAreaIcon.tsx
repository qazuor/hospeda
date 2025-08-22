import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * FirePitAreaIcon icon component
 *
 * @example
 * ```tsx
 * import { FirePitAreaIcon } from '@repo/icons';
 *
 * // Basic usage
 * <FirePitAreaIcon />
 *
 * // With custom size and color
 * <FirePitAreaIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <FirePitAreaIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const FirePitAreaIcon = ({
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
        <title>{ariaLabel || 'Fire Pit Area'}</title>
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
);
