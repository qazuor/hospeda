import { CaretDown } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

/**
 * LoadMoreIcon icon component
 *
 * @example
 * ```tsx
 * import { LoadMoreIcon } from '@repo/icons';
 *
 * // Basic usage
 * <LoadMoreIcon />
 *
 * // With custom size and color
 * <LoadMoreIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <LoadMoreIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const LoadMoreIcon = createPhosphorIcon(CaretDown, 'load-more');
