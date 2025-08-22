import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * SoccerFieldIcon icon component
 *
 * @example
 * ```tsx
 * import { SoccerFieldIcon } from '@repo/icons';
 *
 * // Basic usage
 * <SoccerFieldIcon />
 *
 * // With custom size and color
 * <SoccerFieldIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <SoccerFieldIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const SoccerFieldIcon = ({
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
        <title>{ariaLabel || 'Soccer Field'}</title>
        <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
        <path d="m8.5 8.5 7 7" />
        <path d="m17 2 3 3" />
        <path d="m15 6 3.5-3.5" />
        <path d="m20 5 3 3" />
        <path d="m15 8 3 3" />
    </svg>
);
