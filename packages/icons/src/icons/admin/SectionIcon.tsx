import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * SectionIcon icon component
 *
 * @example
 * ```tsx
 * import { SectionIcon } from '@repo/icons';
 *
 * // Basic usage
 * <SectionIcon />
 *
 * // With custom size and color
 * <SectionIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <SectionIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const SectionIcon = ({
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
        <title>{ariaLabel || 'Section'}</title>
        <rect
            width="7"
            height="7"
            x="3"
            y="3"
            rx="1"
        />
        <rect
            width="7"
            height="7"
            x="14"
            y="3"
            rx="1"
        />
        <rect
            width="7"
            height="7"
            x="14"
            y="14"
            rx="1"
        />
        <rect
            width="7"
            height="7"
            x="3"
            y="14"
            rx="1"
        />
    </svg>
);
