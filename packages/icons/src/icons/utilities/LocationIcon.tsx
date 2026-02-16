import { MapPin } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

/**
 * LocationIcon icon component
 *
 * @example
 * ```tsx
 * import { LocationIcon } from '@repo/icons';
 *
 * // Basic usage
 * <LocationIcon />
 *
 * // With custom size and color
 * <LocationIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <LocationIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const LocationIcon = createPhosphorIcon(MapPin, 'location');
