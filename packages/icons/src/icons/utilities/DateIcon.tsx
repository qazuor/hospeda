import { CalendarBlank } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

/**
 * DateIcon icon component
 *
 * @example
 * ```tsx
 * import { DateIcon } from '@repo/icons';
 *
 * // Basic usage
 * <DateIcon />
 *
 * // With custom size and color
 * <DateIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <DateIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const DateIcon = createPhosphorIcon(CalendarBlank, 'date');
