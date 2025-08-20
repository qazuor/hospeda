import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * LanguageIcon component
 *
 * @example
 * ```tsx
 * import { LanguageIcon } from '@repo/icons';
 *
 * // Basic usage
 * <LanguageIcon />
 *
 * // With custom size and color
 * <LanguageIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <LanguageIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const LanguageIcon = ({
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
        aria-label={ariaLabel || 'language icon'}
        {...props}
    >
        <title>{ariaLabel || 'Language'}</title>
        <path d="m5 8 6 6" />
        <path d="m4 14 6-6 2-3" />
        <path d="M2 5h12" />
        <path d="M7 2h1" />
        <path d="m22 22-5-10-5 10" />
        <path d="M14 18h6" />
    </svg>
);
