import { ArrowClockwise } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

/**
 * RefreshIcon icon component
 *
 * @example
 * ```tsx
 * import { RefreshIcon } from '@repo/icons';
 *
 * // Basic usage
 * <RefreshIcon />
 *
 * // With custom size and color
 * <RefreshIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <RefreshIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const RefreshIcon = createPhosphorIcon(ArrowClockwise, 'refresh');
