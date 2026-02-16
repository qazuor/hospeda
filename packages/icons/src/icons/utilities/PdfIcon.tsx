import { FilePdf } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

/**
 * PdfIcon icon component
 *
 * @example
 * ```tsx
 * import { PdfIcon } from '@repo/icons';
 *
 * // Basic usage
 * <PdfIcon />
 *
 * // With custom size and color
 * <PdfIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <PdfIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const PdfIcon = createPhosphorIcon(FilePdf, 'pdf');
