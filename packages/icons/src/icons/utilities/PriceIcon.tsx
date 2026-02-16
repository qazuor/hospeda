import { CurrencyDollar } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

/**
 * PriceIcon icon component
 *
 * @example
 * ```tsx
 * import { PriceIcon } from '@repo/icons';
 *
 * // Basic usage
 * <PriceIcon />
 *
 * // With custom size and color
 * <PriceIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <PriceIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const PriceIcon = createPhosphorIcon(CurrencyDollar, 'price');
