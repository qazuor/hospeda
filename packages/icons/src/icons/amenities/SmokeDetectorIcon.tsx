import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * SmokeDetectorIcon icon component
 *
 * @example
 * ```tsx
 * import { SmokeDetectorIcon } from '@repo/icons';
 *
 * // Basic usage
 * <SmokeDetectorIcon />
 *
 * // With custom size and color
 * <SmokeDetectorIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <SmokeDetectorIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const SmokeDetectorIcon = ({
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
        <title>{ariaLabel || 'Smoke Detector'}</title>
        <path d="M13.5 2 10 8.5 13.5 15 17 8.5 13.5 2Z" />
        <path d="M17.5 8.5 21 15h-7l3.5-6.5Z" />
        <path d="M6.5 15.5 3 22h7l-3.5-6.5Z" />
        <path d="M15.5 8.5c0-.828.672-1.5 1.5-1.5s1.5.672 1.5 1.5-.672 1.5-1.5 1.5-1.5-.672-1.5-1.5Z" />
        <path d="M9.5 12.5c0-.828.672-1.5 1.5-1.5s1.5.672 1.5 1.5-.672 1.5-1.5 1.5-1.5-.672-1.5-1.5Z" />
    </svg>
);
