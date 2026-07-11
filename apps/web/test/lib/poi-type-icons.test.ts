/**
 * @file poi-type-icons.test.ts
 * @description Unit tests for the POI-type → icon resolver. Verifies that
 * every value of `PointOfInterestTypeEnum` maps to a defined icon component
 * and that unknown values fall back to the generic fallback icon (HOS-113
 * Phase 4).
 */

import {
    BeachIcon,
    HistoricMonumentIcon,
    MainSquareIcon,
    MunicipalStadiumIcon,
    MuseumIcon,
    NaturalReserveIcon,
    ParkIcon,
    PrivateViewpointIcon,
    TagIcon
} from '@repo/icons';
import { PointOfInterestTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    getPointOfInterestTypeIcon,
    POINT_OF_INTEREST_TYPE_FALLBACK_ICON
} from '../../src/lib/poi-type-icons';

describe('getPointOfInterestTypeIcon', () => {
    it('returns BeachIcon for BEACH', () => {
        expect(getPointOfInterestTypeIcon({ type: 'BEACH' })).toBe(BeachIcon);
    });

    it('returns MunicipalStadiumIcon for STADIUM', () => {
        expect(getPointOfInterestTypeIcon({ type: 'STADIUM' })).toBe(MunicipalStadiumIcon);
    });

    it('returns ParkIcon for PARK', () => {
        expect(getPointOfInterestTypeIcon({ type: 'PARK' })).toBe(ParkIcon);
    });

    it('returns MuseumIcon for MUSEUM', () => {
        expect(getPointOfInterestTypeIcon({ type: 'MUSEUM' })).toBe(MuseumIcon);
    });

    it('returns MainSquareIcon for PLAZA', () => {
        expect(getPointOfInterestTypeIcon({ type: 'PLAZA' })).toBe(MainSquareIcon);
    });

    it('returns HistoricMonumentIcon for MONUMENT', () => {
        expect(getPointOfInterestTypeIcon({ type: 'MONUMENT' })).toBe(HistoricMonumentIcon);
    });

    it('returns PrivateViewpointIcon for VIEWPOINT', () => {
        expect(getPointOfInterestTypeIcon({ type: 'VIEWPOINT' })).toBe(PrivateViewpointIcon);
    });

    it('returns NaturalReserveIcon for NATURAL', () => {
        expect(getPointOfInterestTypeIcon({ type: 'NATURAL' })).toBe(NaturalReserveIcon);
    });

    it('returns TagIcon for OTHER', () => {
        expect(getPointOfInterestTypeIcon({ type: 'OTHER' })).toBe(TagIcon);
    });

    it('is case-insensitive for the input type', () => {
        expect(getPointOfInterestTypeIcon({ type: 'beach' })).toBe(BeachIcon);
        expect(getPointOfInterestTypeIcon({ type: 'Stadium' })).toBe(MunicipalStadiumIcon);
    });

    it('falls back to POINT_OF_INTEREST_TYPE_FALLBACK_ICON for unknown types', () => {
        expect(getPointOfInterestTypeIcon({ type: 'spaceship' })).toBe(
            POINT_OF_INTEREST_TYPE_FALLBACK_ICON
        );
        expect(getPointOfInterestTypeIcon({ type: '' })).toBe(POINT_OF_INTEREST_TYPE_FALLBACK_ICON);
    });

    it('exposes TagIcon as the fallback icon (matches OTHER)', () => {
        expect(POINT_OF_INTEREST_TYPE_FALLBACK_ICON).toBe(TagIcon);
    });

    it('uses a visually distinct icon per type (no duplicate component references)', () => {
        const icons = Object.values(PointOfInterestTypeEnum).map((type) =>
            getPointOfInterestTypeIcon({ type })
        );
        const unique = new Set(icons);
        expect(unique.size).toBe(icons.length);
    });

    it('covers every value of PointOfInterestTypeEnum with a defined icon component', () => {
        const allTypes = Object.values(PointOfInterestTypeEnum);
        expect(allTypes.length).toBe(9);
        for (const type of allTypes) {
            const icon = getPointOfInterestTypeIcon({ type });
            expect(icon).toBeDefined();
            expect(typeof icon).toBe('function');
        }
    });
});
