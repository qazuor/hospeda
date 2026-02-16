import { SpeakerHigh } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

/**
 * AudioIcon icon component
 *
 * @example
 * ```tsx
 * import { AudioIcon } from '@repo/icons';
 *
 * // Basic usage
 * <AudioIcon />
 *
 * // With custom size and color
 * <AudioIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <AudioIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const AudioIcon = createPhosphorIcon(SpeakerHigh, 'audio');
