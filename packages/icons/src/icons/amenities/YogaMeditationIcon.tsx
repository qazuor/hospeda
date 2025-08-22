import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * YogaMeditationIcon icon component
 *
 * @example
 * ```tsx
 * import { YogaMeditationIcon } from '@repo/icons';
 *
 * // Basic usage
 * <YogaMeditationIcon />
 *
 * // With custom size and color
 * <YogaMeditationIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <YogaMeditationIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const YogaMeditationIcon = ({
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
        <title>{ariaLabel || 'Yoga Meditation'}</title>
        <path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Z" />
        <path d="M12 12c2-2.67 4-4 6-4a4 4 0 1 1 0 8c-2 0-4-1.33-6-4Z" />
    </svg>
);
