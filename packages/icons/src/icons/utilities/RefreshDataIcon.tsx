import { ArrowsClockwise } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

/**
 * RefreshDataIcon icon component
 *
 * @example
 * ```tsx
 * import { RefreshDataIcon } from '@repo/icons';
 *
 * // Basic usage
 * <RefreshDataIcon />
 *
 * // With custom size and color
 * <RefreshDataIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <RefreshDataIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const RefreshDataIcon = createPhosphorIcon(ArrowsClockwise, 'refresh-data');
