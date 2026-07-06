/**
 * @file eventCategoryIcon.test.ts
 * @description Unit tests for the event-category → icon COMPONENT resolver
 * added for BETA-113 (icon parity: every quick-filter chip gets a leading
 * icon). Covers `getEventCategoryIconComponent`, which is a thin wrapper over
 * the pre-existing `getEventCategoryIconName` + a name → component lookup.
 */

import {
    AmphitheaterIcon,
    BallroomIcon,
    CulturalCenterIcon,
    EventIcon,
    RestaurantIcon
} from '@repo/icons';
import { describe, expect, it } from 'vitest';
import { getEventCategoryIconComponent } from '../../../../../src/components/shared/cards/utils/eventCategoryIcon';

describe('getEventCategoryIconComponent', () => {
    it('resolves the music category to BallroomIcon (case-insensitive)', () => {
        expect(getEventCategoryIconComponent('MUSIC')).toBe(BallroomIcon);
        expect(getEventCategoryIconComponent('music')).toBe(BallroomIcon);
    });

    it('resolves the culture category to CulturalCenterIcon', () => {
        expect(getEventCategoryIconComponent('CULTURE')).toBe(CulturalCenterIcon);
    });

    it('resolves the gastronomy category to RestaurantIcon', () => {
        expect(getEventCategoryIconComponent('GASTRONOMY')).toBe(RestaurantIcon);
    });

    it('resolves theater to AmphitheaterIcon — the category the @repo/icons domain map lacks', () => {
        // This is the whole reason this local resolver exists instead of
        // `@repo/icons`' own `getEventCategoryIcon`: that domain map has no
        // `theater` entry and would silently fall back to a generic icon.
        expect(getEventCategoryIconComponent('THEATER')).toBe(AmphitheaterIcon);
    });

    it('falls back to EventIcon for an unknown category', () => {
        expect(getEventCategoryIconComponent('NOT_A_REAL_CATEGORY')).toBe(EventIcon);
    });
});
