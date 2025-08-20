import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * MicrowaveIcon icon component
 *
 * @example
 * ```tsx
 * import { MicrowaveIcon } from '@repo/icons';
 *
 * // Basic usage
 * <MicrowaveIcon />
 *
 * // With custom size and color
 * <MicrowaveIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <MicrowaveIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const MicrowaveIcon = ({
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
        <title>{ariaLabel || 'Microwave'}</title>
        <rect
            width="20"
            height="15"
            x="2"
            y="4"
            rx="2"
        />
        <rect
            width="8"
            height="7"
            x="6"
            y="8"
            rx="1"
        />
        <path d="M18 8v7" />
        <path d="M6 19v2" />
        <path d="M18 19v2" />
    </svg>
);
