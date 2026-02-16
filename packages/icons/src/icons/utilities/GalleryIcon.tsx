import { Images } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

/**
 * GalleryIcon icon component
 *
 * @example
 * ```tsx
 * import { GalleryIcon } from '@repo/icons';
 *
 * // Basic usage
 * <GalleryIcon />
 *
 * // With custom size and color
 * <GalleryIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <GalleryIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const GalleryIcon = createPhosphorIcon(Images, 'gallery');
