import { SortAscending } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

/**
 * SortIcon icon component
 *
 * @example
 * ```tsx
 * import { SortIcon } from '@repo/icons';
 *
 * // Basic usage
 * <SortIcon />
 *
 * // With custom size and color
 * <SortIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <SortIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const SortIcon = createPhosphorIcon(SortAscending, 'sort');
