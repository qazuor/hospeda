import { ShareNetwork } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

/**
 * ShareIcon icon component
 *
 * @example
 * ```tsx
 * import { ShareIcon } from '@repo/icons';
 *
 * // Basic usage
 * <ShareIcon />
 *
 * // With custom size and color
 * <ShareIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <ShareIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const ShareIcon = createPhosphorIcon(ShareNetwork, 'share');
