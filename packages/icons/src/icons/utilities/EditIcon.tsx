import { PencilSimple } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

/**
 * EditIcon icon component
 *
 * @example
 * ```tsx
 * import { EditIcon } from '@repo/icons';
 *
 * // Basic usage
 * <EditIcon />
 *
 * // With custom size and color
 * <EditIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <EditIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const EditIcon = createPhosphorIcon(PencilSimple, 'edit');
