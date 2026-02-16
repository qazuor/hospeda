import { Calendar } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

/**
 * CalendarIcon icon component
 *
 * @example
 * ```tsx
 * import { CalendarIcon } from '@repo/icons';
 *
 * // Basic usage
 * <CalendarIcon />
 *
 * // With custom size and color
 * <CalendarIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <CalendarIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const CalendarIcon = createPhosphorIcon(Calendar, 'calendar');
