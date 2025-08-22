import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * BackupIcon icon component
 *
 * @example
 * ```tsx
 * import { BackupIcon } from '@repo/icons';
 *
 * // Basic usage
 * <BackupIcon />
 *
 * // With custom size and color
 * <BackupIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <BackupIcon className="text-green-500 hover:text-green-600" />
 * ```
 */
export const BackupIcon = ({
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
        <title>{ariaLabel || 'Backup'}</title>
        <ellipse
            cx="12"
            cy="5"
            rx="9"
            ry="3"
        />
        <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
        <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
    </svg>
);
