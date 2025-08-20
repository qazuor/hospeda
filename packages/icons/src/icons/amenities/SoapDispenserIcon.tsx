import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * SoapDispenserIcon icon component
 *
 * @example
 * ```tsx
 * import { SoapDispenserIcon } from '@repo/icons';
 *
 * // Basic usage
 * <SoapDispenserIcon />
 *
 * // With custom size and color
 * <SoapDispenserIcon size="lg" color="#06B6D4" />
 *
 * // With Tailwind classes
 * <SoapDispenserIcon className="text-cyan-500 hover:text-cyan-600" />
 * ```
 */
export const SoapDispenserIcon = ({
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
        <title>{ariaLabel || 'Soap Dispenser'}</title>
        <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8Z" />
        <line
            x1="6"
            x2="6"
            y1="1"
            y2="4"
        />
        <line
            x1="10"
            x2="10"
            y1="1"
            y2="4"
        />
        <line
            x1="14"
            x2="14"
            y1="1"
            y2="4"
        />
        <circle
            cx="12"
            cy="12"
            r="2"
        />
        <path d="m10 14 2 2 2-2" />
    </svg>
);
