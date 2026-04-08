/**
 * @file homepage-config.ts
 * @description Top-level configuration object for the web2 homepage.
 *
 * Controls hero image rotation speed and the number of items rendered
 * in each homepage section. All counts here MUST match the length of
 * the corresponding mock data arrays (or be <= that length).
 */

import type { HomepageConfig } from './types';

/**
 * Shared configuration for every section of the homepage.
 *
 * Import this in the homepage page file and pass individual fields
 * to each section component as needed.
 *
 * @example
 * ```ts
 * import { homepageConfig } from '@/data/homepage-config';
 * const items = homepageAccommodations.slice(0, homepageConfig.accommodationsCount);
 * ```
 */
export const homepageConfig: HomepageConfig = {
    heroImages: [
        '/src/assets/images/hero/hero-playa.jpg',
        '/src/assets/images/hero/hero-atardecer.jpg',
        '/src/assets/images/hero/hero-isla.jpg'
    ],
    heroRotationInterval: 5000,
    accommodationsCount: 8,
    destinationsCount: 4,
    eventsCount: 4,
    postsCount: 6,
    reviewsCount: 10
};
