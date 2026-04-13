/**
 * @file homepage-features.ts
 * @description Static feature items for the CtaOwnersSection on the homepage.
 *
 * Each item references an icon component name (mapped in the Astro component)
 * and i18n keys for title/description so all user-facing text goes through `t()`.
 */

import type { FeatureItemData } from './types-ui';

/**
 * CTA feature list displayed in the "For Owners" section of the homepage.
 *
 * Icons must match keys in the `iconMap` defined in `CtaOwnersSection.astro`.
 */
export const ctaFeatures: readonly FeatureItemData[] = [
    {
        icon: 'SparkleIcon',
        titleKey: 'home.ownerCta.feature1.title',
        descriptionKey: 'home.ownerCta.feature1.description'
    },
    {
        icon: 'SearchIcon',
        titleKey: 'home.ownerCta.feature2.title',
        descriptionKey: 'home.ownerCta.feature2.description'
    },
    {
        icon: 'ShieldIcon',
        titleKey: 'home.ownerCta.feature3.title',
        descriptionKey: 'home.ownerCta.feature3.description'
    }
] as const;
