import { CheckCircle } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

/**
 * ConfirmIcon icon component
 *
 * @example
 * ```tsx
 * import { ConfirmIcon } from '@repo/icons';
 *
 * // Basic usage
 * <ConfirmIcon />
 *
 * // With custom size and color
 * <ConfirmIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <ConfirmIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const ConfirmIcon = createPhosphorIcon(CheckCircle, 'confirm');
