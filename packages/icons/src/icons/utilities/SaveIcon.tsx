import { FloppyDisk } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

/**
 * SaveIcon icon component
 *
 * @example
 * ```tsx
 * import { SaveIcon } from '@repo/icons';
 *
 * // Basic usage
 * <SaveIcon />
 *
 * // With custom size and color
 * <SaveIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <SaveIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const SaveIcon = createPhosphorIcon(FloppyDisk, 'save');
