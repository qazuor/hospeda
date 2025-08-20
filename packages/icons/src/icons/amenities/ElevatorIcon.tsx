import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * ElevatorIcon icon component
 *
 * @example
 * ```tsx
 * import { ElevatorIcon } from '@repo/icons';
 *
 * // Basic usage
 * <ElevatorIcon />
 *
 * // With custom size and color
 * <ElevatorIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <ElevatorIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const ElevatorIcon = ({
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
        <title>{ariaLabel || 'Elevator'}</title>
        <path d="M12 2v20" />
        <path d="m8 18 4 4 4-4" />
        <path d="m8 6 4-4 4 4" />
    </svg>
);
