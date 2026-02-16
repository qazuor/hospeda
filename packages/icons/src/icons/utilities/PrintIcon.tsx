import { Printer } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

/**
 * PrintIcon icon component
 *
 * @example
 * ```tsx
 * import { PrintIcon } from '@repo/icons';
 *
 * // Basic usage
 * <PrintIcon />
 *
 * // With custom size and color
 * <PrintIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <PrintIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const PrintIcon = createPhosphorIcon(Printer, 'print');
