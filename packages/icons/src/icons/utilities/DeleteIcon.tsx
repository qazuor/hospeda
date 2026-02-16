import { Trash } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

/**
 * DeleteIcon icon component
 *
 * @example
 * ```tsx
 * import { DeleteIcon } from '@repo/icons';
 *
 * // Basic usage
 * <DeleteIcon />
 *
 * // With custom size and color
 * <DeleteIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <DeleteIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const DeleteIcon = createPhosphorIcon(Trash, 'delete');
