import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * RuralActivitiesIcon icon component
 *
 * @example
 * ```tsx
 * import { RuralActivitiesIcon } from '@repo/icons';
 *
 * // Basic usage
 * <RuralActivitiesIcon />
 *
 * // With custom size and color
 * <RuralActivitiesIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <RuralActivitiesIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const RuralActivitiesIcon = ({
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
        <title>{ariaLabel || 'Rural Activities'}</title>
        <path d="M2 12h20" />
        <path d="M10 16v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4" />
        <path d="M10 8V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v4" />
        <path d="M20 16v1a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-1" />
        <path d="M14 8V7c0-1.1.9-2 2-2h2a2 2 0 0 1 2 2v1" />
    </svg>
);
