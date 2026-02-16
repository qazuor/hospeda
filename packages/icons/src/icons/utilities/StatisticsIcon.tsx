import { ChartLine } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

/**
 * StatisticsIcon icon component
 *
 * @example
 * ```tsx
 * import { StatisticsIcon } from '@repo/icons';
 *
 * // Basic usage
 * <StatisticsIcon />
 *
 * // With custom size and color
 * <StatisticsIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <StatisticsIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const StatisticsIcon = createPhosphorIcon(ChartLine, 'statistics');
