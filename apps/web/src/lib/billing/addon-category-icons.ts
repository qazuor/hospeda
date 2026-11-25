import { HistoricHouseIcon, ImageIcon, PackageIcon, StarIcon } from '@repo/icons';
import type { AddonCategory } from './addon-category';

/** Existing repository icons for each add-on category. */
export const ADDON_CATEGORY_ICONS = {
    visibility: StarIcon,
    listings: HistoricHouseIcon,
    media: ImageIcon,
    other: PackageIcon
} satisfies Record<AddonCategory, typeof PackageIcon>;
