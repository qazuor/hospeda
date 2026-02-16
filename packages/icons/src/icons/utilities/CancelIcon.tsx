import { XCircle } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

/**
 * CancelIcon icon component
 *
 * @example
 * ```tsx
 * import { CancelIcon } from '@repo/icons';
 *
 * // Basic usage
 * <CancelIcon />
 *
 * // With custom size and color
 * <CancelIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <CancelIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const CancelIcon = createPhosphorIcon(XCircle, 'cancel');
