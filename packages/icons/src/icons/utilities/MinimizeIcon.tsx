import { ArrowsIn } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

/**
 * MinimizeIcon icon component
 *
 * @example
 * ```tsx
 * import { MinimizeIcon } from '@repo/icons';
 *
 * // Basic usage
 * <MinimizeIcon />
 *
 * // With custom size and color
 * <MinimizeIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <MinimizeIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const MinimizeIcon = createPhosphorIcon(ArrowsIn, 'minimize');
