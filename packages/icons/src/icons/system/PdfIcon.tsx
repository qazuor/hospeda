import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * PdfIcon icon component
 *
 * @example
 * ```tsx
 * import { PdfIcon } from '@repo/icons';
 *
 * // Basic usage
 * <PdfIcon />
 *
 * // With custom size and color
 * <PdfIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <PdfIcon className="text-red-500 hover:text-red-600" />
 * ```
 */
export const PdfIcon = ({
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
        <title>{ariaLabel || 'PDF'}</title>
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
);
