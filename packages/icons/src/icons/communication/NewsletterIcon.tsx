import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * NewsletterIcon icon component
 *
 * @example
 * ```tsx
 * import { NewsletterIcon } from '@repo/icons';
 *
 * // Basic usage
 * <NewsletterIcon />
 *
 * // With custom size and color
 * <NewsletterIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <NewsletterIcon className="text-purple-500 hover:text-purple-600" />
 * ```
 */
export const NewsletterIcon = ({
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
        <title>{ariaLabel || 'Newsletter'}</title>
        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
        <path d="M18 14h-8" />
        <path d="M15 18h-5" />
        <path d="M10 6h8v4h-8V6z" />
    </svg>
);
