import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * UploadIcon icon component
 *
 * @example
 * ```tsx
 * import { UploadIcon } from '@repo/icons';
 *
 * // Basic usage
 * <UploadIcon />
 *
 * // With custom size and color
 * <UploadIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <UploadIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const UploadIcon = ({
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
        <title>{ariaLabel || 'Upload'}</title>
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14,2 14,8 20,8" />
        <line
            x1="12"
            x2="12"
            y1="18"
            y2="12"
        />
        <polyline points="9,15 12,12 15,15" />
    </svg>
);
