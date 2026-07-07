/**
 * @file experience-type-icons.test.ts
 * @description Unit tests for the experience-type → icon resolver. Verifies
 * that every value of `ExperienceTypeEnum` maps to a defined icon component
 * and that unknown values fall back to the generic fallback icon (HOS-97).
 */

import {
    BicyclesIcon,
    BirdWatchingIcon,
    CarIcon,
    CompassIcon,
    CulturalCenterIcon,
    DropIcon,
    HistoricMuseumIcon,
    KayakRentalIcon,
    MotorhomeParkingIcon,
    NaturalReserveIcon,
    RecreationalBoatingIcon,
    RuralActivitiesIcon,
    SportFishingIcon,
    TagIcon
} from '@repo/icons';
import { ExperienceTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    EXPERIENCE_TYPE_FALLBACK_ICON,
    getExperienceTypeIcon
} from '../../src/lib/experience-type-icons';

describe('getExperienceTypeIcon', () => {
    it('returns CarIcon for CAR_RENTAL', () => {
        expect(getExperienceTypeIcon({ type: 'CAR_RENTAL' })).toBe(CarIcon);
    });

    it('returns BicyclesIcon for BIKE_RENTAL', () => {
        expect(getExperienceTypeIcon({ type: 'BIKE_RENTAL' })).toBe(BicyclesIcon);
    });

    it('returns KayakRentalIcon for KAYAK_RENTAL', () => {
        expect(getExperienceTypeIcon({ type: 'KAYAK_RENTAL' })).toBe(KayakRentalIcon);
    });

    it('returns MotorhomeParkingIcon for QUAD_RENTAL', () => {
        expect(getExperienceTypeIcon({ type: 'QUAD_RENTAL' })).toBe(MotorhomeParkingIcon);
    });

    it('returns CompassIcon for TOUR_GUIDE', () => {
        expect(getExperienceTypeIcon({ type: 'TOUR_GUIDE' })).toBe(CompassIcon);
    });

    it('returns HistoricMuseumIcon for GUIDED_VISIT', () => {
        expect(getExperienceTypeIcon({ type: 'GUIDED_VISIT' })).toBe(HistoricMuseumIcon);
    });

    it('returns NaturalReserveIcon for EXCURSION', () => {
        expect(getExperienceTypeIcon({ type: 'EXCURSION' })).toBe(NaturalReserveIcon);
    });

    it('returns RecreationalBoatingIcon for BOAT_TRIP', () => {
        expect(getExperienceTypeIcon({ type: 'BOAT_TRIP' })).toBe(RecreationalBoatingIcon);
    });

    it('returns SportFishingIcon for FISHING_CHARTER', () => {
        expect(getExperienceTypeIcon({ type: 'FISHING_CHARTER' })).toBe(SportFishingIcon);
    });

    it('returns BirdWatchingIcon for BIRD_WATCHING', () => {
        expect(getExperienceTypeIcon({ type: 'BIRD_WATCHING' })).toBe(BirdWatchingIcon);
    });

    it('returns CulturalCenterIcon for CULTURAL_TOUR', () => {
        expect(getExperienceTypeIcon({ type: 'CULTURAL_TOUR' })).toBe(CulturalCenterIcon);
    });

    it('returns DropIcon for WINE_TASTING', () => {
        expect(getExperienceTypeIcon({ type: 'WINE_TASTING' })).toBe(DropIcon);
    });

    it('returns RuralActivitiesIcon for OUTDOOR_ADVENTURE', () => {
        expect(getExperienceTypeIcon({ type: 'OUTDOOR_ADVENTURE' })).toBe(RuralActivitiesIcon);
    });

    it('returns TagIcon for OTHER', () => {
        expect(getExperienceTypeIcon({ type: 'OTHER' })).toBe(TagIcon);
    });

    it('is case-insensitive for the input type', () => {
        expect(getExperienceTypeIcon({ type: 'car_rental' })).toBe(CarIcon);
        expect(getExperienceTypeIcon({ type: 'Bird_Watching' })).toBe(BirdWatchingIcon);
    });

    it('falls back to EXPERIENCE_TYPE_FALLBACK_ICON for unknown types', () => {
        expect(getExperienceTypeIcon({ type: 'spaceship' })).toBe(EXPERIENCE_TYPE_FALLBACK_ICON);
        expect(getExperienceTypeIcon({ type: '' })).toBe(EXPERIENCE_TYPE_FALLBACK_ICON);
    });

    it('exposes TagIcon as the fallback icon (matches OTHER)', () => {
        expect(EXPERIENCE_TYPE_FALLBACK_ICON).toBe(TagIcon);
    });

    it('uses a visually distinct icon per type (no duplicate component references)', () => {
        const icons = Object.values(ExperienceTypeEnum).map((type) =>
            getExperienceTypeIcon({ type })
        );
        const unique = new Set(icons);
        expect(unique.size).toBe(icons.length);
    });

    it('covers every value of ExperienceTypeEnum with a defined icon component', () => {
        const allTypes = Object.values(ExperienceTypeEnum);
        expect(allTypes.length).toBeGreaterThan(0);
        for (const type of allTypes) {
            const icon = getExperienceTypeIcon({ type });
            expect(icon).toBeDefined();
            expect(typeof icon).toBe('function');
        }
    });
});
