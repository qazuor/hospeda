import { PlusCircle } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

/**
 * CreateIcon icon component
 *
 * @example
 * ```tsx
 * import { CreateIcon } from '@repo/icons';
 *
 * // Basic usage
 * <CreateIcon />
 *
 * // With custom size and color
 * <CreateIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <CreateIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const CreateIcon = createPhosphorIcon(PlusCircle, 'create');
