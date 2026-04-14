import { Shower } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

/**
 * Bathrooms icon — represents the number of bathrooms in an accommodation.
 * Uses Phosphor Shower icon (BathtubSimple does NOT exist in @phosphor-icons/react v2).
 */
export const BathroomsIcon = createPhosphorIcon(Shower, 'bathrooms');
