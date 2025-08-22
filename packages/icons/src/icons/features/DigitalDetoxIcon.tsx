import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * DigitalDetoxIcon icon component
 *
 * @example
 * ```tsx
 * import { DigitalDetoxIcon } from '@repo/icons';
 *
 * // Basic usage
 * <DigitalDetoxIcon />
 *
 * // With custom size and color
 * <DigitalDetoxIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <DigitalDetoxIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const DigitalDetoxIcon = ({
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
        <title>{ariaLabel || 'Digital Detox'}</title>
        <path d="M14 2a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8z" />
        <path d="M15 8h.01" />
        <path d="M9 16h2" />
        <path d="m2 2 20 20" />
    </svg>
);
