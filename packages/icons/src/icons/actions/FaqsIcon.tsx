import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * FaqsIcon component
 *
 * @example
 * ```tsx
 * import { FaqsIcon } from '@repo/icons';
 *
 * // Basic usage
 * <FaqsIcon />
 *
 * // With custom size and color
 * <FaqsIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <FaqsIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const FaqsIcon = ({
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
        aria-label={ariaLabel || 'faqs icon'}
        {...props}
    >
        <title>{ariaLabel || 'Faqs'}</title>
        <path d="M16 12H3" />
        <path d="M16 18H3" />
        <path d="M16 6H3" />
        <path d="M21 12h.01" />
        <path d="M21 18h.01" />
        <path d="M21 6h.01" />
    </svg>
);
