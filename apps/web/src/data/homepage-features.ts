/**
 * @file homepage-features.ts
 * @description Mock feature/benefit item data for the homepage About and CTA sections.
 *
 * Exports two separate arrays:
 * - `aboutFeatures`: 2 items used in the About section (trust signals).
 * - `ctaFeatures`: 3 items used in the Owner CTA / Features section.
 *
 * All title and description values are i18n keys resolved via `t()` at render time.
 * Icon names match Phosphor icon wrappers from `@repo/icons`.
 */

import type { FeatureItemData } from './types';

/**
 * Feature items for the About section (trust signals shown alongside the
 * platform description). Emphasises verification and reliability.
 *
 * @example
 * ```ts
 * import { aboutFeatures } from '@/data/homepage-features';
 * aboutFeatures.forEach(f => console.log(f.icon, f.titleKey));
 * ```
 */
export const aboutFeatures: readonly FeatureItemData[] = [
    {
        icon: 'ShieldIcon',
        titleKey: 'home.about.feature1.title',
        descriptionKey: 'home.about.feature1.description'
    },
    {
        icon: 'CalendarDotsIcon',
        titleKey: 'home.about.feature2.title',
        descriptionKey: 'home.about.feature2.description'
    }
] as const;

/**
 * Feature items for the Owner CTA / Features section. Highlights the
 * three main benefits for accommodation owners listing on the platform.
 *
 * @example
 * ```ts
 * import { ctaFeatures } from '@/data/homepage-features';
 * ctaFeatures.forEach(f => console.log(f.icon, f.titleKey));
 * ```
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
