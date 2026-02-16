import { CaretLeft } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

/**
 * PreviousIcon icon component
 *
 * @example
 * ```tsx
 * import { PreviousIcon } from '@repo/icons';
 *
 * // Basic usage
 * <PreviousIcon />
 *
 * // With custom size and color
 * <PreviousIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <PreviousIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const PreviousIcon = createPhosphorIcon(CaretLeft, 'previous');
