import { FileText } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

/**
 * DocumentIcon icon component
 *
 * @example
 * ```tsx
 * import { DocumentIcon } from '@repo/icons';
 *
 * // Basic usage
 * <DocumentIcon />
 *
 * // With custom size and color
 * <DocumentIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <DocumentIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const DocumentIcon = createPhosphorIcon(FileText, 'document');
