import { ArrowsOut } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

/**
 * FullscreenIcon icon component
 *
 * @example
 * ```tsx
 * import { FullscreenIcon } from '@repo/icons';
 *
 * // Basic usage
 * <FullscreenIcon />
 *
 * // With custom size and color
 * <FullscreenIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <FullscreenIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const FullscreenIcon = createPhosphorIcon(ArrowsOut, 'fullscreen');
