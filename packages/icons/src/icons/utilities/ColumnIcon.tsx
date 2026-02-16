import { Columns } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

/**
 * ColumnIcon icon component
 *
 * @example
 * ```tsx
 * import { ColumnIcon } from '@repo/icons';
 *
 * // Basic usage
 * <ColumnIcon />
 *
 * // With custom size and color
 * <ColumnIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <ColumnIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const ColumnIcon = createPhosphorIcon(Columns, 'column');
