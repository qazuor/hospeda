import { Funnel } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

/**
 * FilterIcon icon component
 *
 * @example
 * ```tsx
 * import { FilterIcon } from '@repo/icons';
 *
 * // Basic usage
 * <FilterIcon />
 *
 * // With custom size and color
 * <FilterIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <FilterIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const FilterIcon = createPhosphorIcon(Funnel, 'filter');
