/**
 * @file postCategoryIcon.test.ts
 * @description Unit tests for the post-category → icon COMPONENT resolver that
 * backs the blog cards' no-cover placeholder, mirroring the event cards'
 * treatment.
 */

import {
    CulturalCenterIcon,
    FileTextIcon,
    MuseumIcon,
    NatureReserveIcon,
    RestaurantIcon,
    SportsCenterIcon,
    UsersIcon,
    WellnessCenterIcon
} from '@repo/icons';
import { PostCategoryEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { getEventCategoryIconComponent } from '../../../../../src/components/shared/cards/utils/eventCategoryIcon';
import { getPostCategoryIconComponent } from '../../../../../src/components/shared/cards/utils/postCategoryIcon';

describe('getPostCategoryIconComponent', () => {
    it('resolves every PostCategoryEnum value to a real icon, never the fallback', () => {
        // A missing entry would silently degrade to the generic article icon,
        // which is exactly the "every card looks the same" bug this map exists
        // to prevent. GENERAL is the one category whose icon IS the fallback.
        const categories = Object.values(PostCategoryEnum).filter(
            (c) => c !== PostCategoryEnum.GENERAL
        );

        for (const category of categories) {
            expect(
                getPostCategoryIconComponent(category),
                `category ${category} fell back to the generic icon`
            ).not.toBe(FileTextIcon);
        }
    });

    it('gives distinct icons to distinct categories', () => {
        const resolved = Object.values(PostCategoryEnum).map((c) =>
            getPostCategoryIconComponent(c)
        );
        expect(new Set(resolved).size).toBe(Object.values(PostCategoryEnum).length);
    });

    it('is case-insensitive', () => {
        expect(getPostCategoryIconComponent('gastronomy')).toBe(RestaurantIcon);
        expect(getPostCategoryIconComponent('GASTRONOMY')).toBe(RestaurantIcon);
    });

    it('falls back to the generic article icon for unknown, empty and nullish categories', () => {
        expect(getPostCategoryIconComponent('NOT_A_REAL_CATEGORY')).toBe(FileTextIcon);
        expect(getPostCategoryIconComponent('')).toBe(FileTextIcon);
        expect(getPostCategoryIconComponent(null)).toBe(FileTextIcon);
        expect(getPostCategoryIconComponent(undefined)).toBe(FileTextIcon);
    });

    it('shares the event map icon for categories both entities have', () => {
        // "Arte" must not look like two different things depending on whether
        // the reader is on an event card or a blog card.
        expect(getPostCategoryIconComponent(PostCategoryEnum.CULTURE)).toBe(
            getEventCategoryIconComponent('cultural')
        );
        expect(getPostCategoryIconComponent(PostCategoryEnum.GASTRONOMY)).toBe(
            getEventCategoryIconComponent('gastronomy')
        );
        expect(getPostCategoryIconComponent(PostCategoryEnum.NATURE)).toBe(
            getEventCategoryIconComponent('nature')
        );
        expect(getPostCategoryIconComponent(PostCategoryEnum.SPORT)).toBe(
            getEventCategoryIconComponent('sports')
        );
        expect(getPostCategoryIconComponent(PostCategoryEnum.WELLNESS)).toBe(
            getEventCategoryIconComponent('wellness')
        );
        expect(getPostCategoryIconComponent(PostCategoryEnum.FAMILY)).toBe(
            getEventCategoryIconComponent('family')
        );
        expect(getPostCategoryIconComponent(PostCategoryEnum.ART)).toBe(
            getEventCategoryIconComponent('art')
        );
        expect(getPostCategoryIconComponent(PostCategoryEnum.FESTIVALS)).toBe(
            getEventCategoryIconComponent('festival')
        );
    });

    it('pins the shared-category icons so a rename cannot silently drift', () => {
        expect(getPostCategoryIconComponent(PostCategoryEnum.CULTURE)).toBe(CulturalCenterIcon);
        expect(getPostCategoryIconComponent(PostCategoryEnum.NATURE)).toBe(NatureReserveIcon);
        expect(getPostCategoryIconComponent(PostCategoryEnum.SPORT)).toBe(SportsCenterIcon);
        expect(getPostCategoryIconComponent(PostCategoryEnum.WELLNESS)).toBe(WellnessCenterIcon);
        expect(getPostCategoryIconComponent(PostCategoryEnum.FAMILY)).toBe(UsersIcon);
        expect(getPostCategoryIconComponent(PostCategoryEnum.ART)).toBe(MuseumIcon);
    });
});
