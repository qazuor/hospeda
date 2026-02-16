import { VideoCamera } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

/**
 * VideoIcon icon component
 *
 * @example
 * ```tsx
 * import { VideoIcon } from '@repo/icons';
 *
 * // Basic usage
 * <VideoIcon />
 *
 * // With custom size and color
 * <VideoIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <VideoIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const VideoIcon = createPhosphorIcon(VideoCamera, 'video');
