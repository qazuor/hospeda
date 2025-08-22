import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * MotorhomeParkingIcon icon component
 *
 * @example
 * ```tsx
 * import { MotorhomeParkingIcon } from '@repo/icons';
 *
 * // Basic usage
 * <MotorhomeParkingIcon />
 *
 * // With custom size and color
 * <MotorhomeParkingIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <MotorhomeParkingIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const MotorhomeParkingIcon = ({
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
        <title>{ariaLabel || 'Motorhome Parking'}</title>
        <path d="M14 18V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
        <path d="M15 18H9" />
        <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
        <circle
            cx="17"
            cy="18"
            r="2"
        />
        <circle
            cx="7"
            cy="18"
            r="2"
        />
    </svg>
);
