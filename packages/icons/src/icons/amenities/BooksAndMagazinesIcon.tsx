import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * BooksAndMagazinesIcon icon component
 *
 * @example
 * ```tsx
 * import { BooksAndMagazinesIcon } from '@repo/icons';
 *
 * // Basic usage
 * <BooksAndMagazinesIcon />
 *
 * // With custom size and color
 * <BooksAndMagazinesIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <BooksAndMagazinesIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const BooksAndMagazinesIcon = ({
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
        <title>{ariaLabel || 'Books and Magazines'}</title>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
);
