/**
 * @file destination.hierarchy.helpers.test.ts
 * @description Unit tests for pure hierarchy helper functions:
 *   validateDestinationTypeLevel, getExpectedParentType, computeHierarchyPath,
 *   computeHierarchyPathIds, computeHierarchyLevel, isValidParentChildRelation
 */

import { DestinationTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    computeHierarchyLevel,
    computeHierarchyPath,
    computeHierarchyPathIds,
    getExpectedParentType,
    isValidParentChildRelation,
    validateDestinationTypeLevel
} from '../../../src/services/destination/destination.hierarchy.helpers';

// ============================================================================
// validateDestinationTypeLevel
// ============================================================================

describe('validateDestinationTypeLevel', () => {
    it('should return true for COUNTRY at level 0', () => {
        expect(
            validateDestinationTypeLevel({
                destinationType: DestinationTypeEnum.COUNTRY,
                level: 0
            })
        ).toBe(true);
    });

    it('should return true for REGION at level 1', () => {
        expect(
            validateDestinationTypeLevel({
                destinationType: DestinationTypeEnum.REGION,
                level: 1
            })
        ).toBe(true);
    });

    it('should return true for PROVINCE at level 2', () => {
        expect(
            validateDestinationTypeLevel({
                destinationType: DestinationTypeEnum.PROVINCE,
                level: 2
            })
        ).toBe(true);
    });

    it('should return true for DEPARTMENT at level 3', () => {
        expect(
            validateDestinationTypeLevel({
                destinationType: DestinationTypeEnum.DEPARTMENT,
                level: 3
            })
        ).toBe(true);
    });

    it('should return true for CITY at level 4', () => {
        expect(
            validateDestinationTypeLevel({
                destinationType: DestinationTypeEnum.CITY,
                level: 4
            })
        ).toBe(true);
    });

    it('should return true for TOWN at level 5', () => {
        expect(
            validateDestinationTypeLevel({
                destinationType: DestinationTypeEnum.TOWN,
                level: 5
            })
        ).toBe(true);
    });

    it('should return true for NEIGHBORHOOD at level 6', () => {
        expect(
            validateDestinationTypeLevel({
                destinationType: DestinationTypeEnum.NEIGHBORHOOD,
                level: 6
            })
        ).toBe(true);
    });

    it('should return false for COUNTRY at wrong level', () => {
        expect(
            validateDestinationTypeLevel({
                destinationType: DestinationTypeEnum.COUNTRY,
                level: 1
            })
        ).toBe(false);
    });

    it('should return false for CITY at wrong level', () => {
        expect(
            validateDestinationTypeLevel({
                destinationType: DestinationTypeEnum.CITY,
                level: 0
            })
        ).toBe(false);
    });
});

// ============================================================================
// getExpectedParentType
// ============================================================================

describe('getExpectedParentType', () => {
    it('should return null for COUNTRY (root level)', () => {
        expect(getExpectedParentType({ destinationType: DestinationTypeEnum.COUNTRY })).toBeNull();
    });

    it('should return COUNTRY for REGION', () => {
        expect(getExpectedParentType({ destinationType: DestinationTypeEnum.REGION })).toBe(
            DestinationTypeEnum.COUNTRY
        );
    });

    it('should return REGION for PROVINCE', () => {
        expect(getExpectedParentType({ destinationType: DestinationTypeEnum.PROVINCE })).toBe(
            DestinationTypeEnum.REGION
        );
    });

    it('should return PROVINCE for DEPARTMENT', () => {
        expect(getExpectedParentType({ destinationType: DestinationTypeEnum.DEPARTMENT })).toBe(
            DestinationTypeEnum.PROVINCE
        );
    });

    it('should return DEPARTMENT for CITY', () => {
        expect(getExpectedParentType({ destinationType: DestinationTypeEnum.CITY })).toBe(
            DestinationTypeEnum.DEPARTMENT
        );
    });

    it('should return CITY for TOWN', () => {
        expect(getExpectedParentType({ destinationType: DestinationTypeEnum.TOWN })).toBe(
            DestinationTypeEnum.CITY
        );
    });

    it('should return TOWN for NEIGHBORHOOD', () => {
        expect(getExpectedParentType({ destinationType: DestinationTypeEnum.NEIGHBORHOOD })).toBe(
            DestinationTypeEnum.TOWN
        );
    });
});

// ============================================================================
// computeHierarchyPath
// ============================================================================

describe('computeHierarchyPath', () => {
    it('should return /slug for root node (no parent path)', () => {
        expect(computeHierarchyPath({ parentPath: null, slug: 'argentina' })).toBe('/argentina');
    });

    it('should append slug to parent path', () => {
        expect(computeHierarchyPath({ parentPath: '/argentina', slug: 'litoral' })).toBe(
            '/argentina/litoral'
        );
    });

    it('should build deep paths correctly', () => {
        expect(
            computeHierarchyPath({
                parentPath: '/argentina/litoral/entre-rios',
                slug: 'concepcion-del-uruguay'
            })
        ).toBe('/argentina/litoral/entre-rios/concepcion-del-uruguay');
    });
});

// ============================================================================
// computeHierarchyPathIds
// ============================================================================

describe('computeHierarchyPathIds', () => {
    it('should return empty string for root node (no parent)', () => {
        expect(computeHierarchyPathIds({ parentPathIds: null, parentId: null })).toBe('');
    });

    it('should return parentId when parentPathIds is null', () => {
        expect(computeHierarchyPathIds({ parentPathIds: null, parentId: 'uuid-1' })).toBe('uuid-1');
    });

    it('should return parentId when parentPathIds is empty string', () => {
        expect(computeHierarchyPathIds({ parentPathIds: '', parentId: 'uuid-1' })).toBe('uuid-1');
    });

    it('should append parentId to parentPathIds', () => {
        expect(computeHierarchyPathIds({ parentPathIds: 'uuid-1', parentId: 'uuid-2' })).toBe(
            'uuid-1/uuid-2'
        );
    });

    it('should build deep pathIds correctly', () => {
        expect(
            computeHierarchyPathIds({
                parentPathIds: 'uuid-1/uuid-2/uuid-3',
                parentId: 'uuid-4'
            })
        ).toBe('uuid-1/uuid-2/uuid-3/uuid-4');
    });
});

// ============================================================================
// computeHierarchyLevel
// ============================================================================

describe('computeHierarchyLevel', () => {
    it('should return 0 when parentLevel is null', () => {
        expect(computeHierarchyLevel({ parentLevel: null })).toBe(0);
    });

    it('should return 0 when parentLevel is undefined', () => {
        // The function checks for both null and undefined
        expect(computeHierarchyLevel({ parentLevel: undefined as unknown as null })).toBe(0);
    });

    it('should return parentLevel + 1', () => {
        expect(computeHierarchyLevel({ parentLevel: 0 })).toBe(1);
    });

    it('should handle deep levels', () => {
        expect(computeHierarchyLevel({ parentLevel: 5 })).toBe(6);
    });
});

// ============================================================================
// isValidParentChildRelation
// ============================================================================

describe('isValidParentChildRelation', () => {
    it('should return true for COUNTRY -> REGION', () => {
        expect(
            isValidParentChildRelation({
                parentType: DestinationTypeEnum.COUNTRY,
                childType: DestinationTypeEnum.REGION
            })
        ).toBe(true);
    });

    it('should return true for REGION -> PROVINCE', () => {
        expect(
            isValidParentChildRelation({
                parentType: DestinationTypeEnum.REGION,
                childType: DestinationTypeEnum.PROVINCE
            })
        ).toBe(true);
    });

    it('should return true for PROVINCE -> DEPARTMENT', () => {
        expect(
            isValidParentChildRelation({
                parentType: DestinationTypeEnum.PROVINCE,
                childType: DestinationTypeEnum.DEPARTMENT
            })
        ).toBe(true);
    });

    it('should return true for DEPARTMENT -> CITY', () => {
        expect(
            isValidParentChildRelation({
                parentType: DestinationTypeEnum.DEPARTMENT,
                childType: DestinationTypeEnum.CITY
            })
        ).toBe(true);
    });

    it('should return true for CITY -> TOWN', () => {
        expect(
            isValidParentChildRelation({
                parentType: DestinationTypeEnum.CITY,
                childType: DestinationTypeEnum.TOWN
            })
        ).toBe(true);
    });

    it('should return true for TOWN -> NEIGHBORHOOD', () => {
        expect(
            isValidParentChildRelation({
                parentType: DestinationTypeEnum.TOWN,
                childType: DestinationTypeEnum.NEIGHBORHOOD
            })
        ).toBe(true);
    });

    it('should return false for COUNTRY -> CITY (skip levels)', () => {
        expect(
            isValidParentChildRelation({
                parentType: DestinationTypeEnum.COUNTRY,
                childType: DestinationTypeEnum.CITY
            })
        ).toBe(false);
    });

    it('should return false for CITY -> COUNTRY (reverse)', () => {
        expect(
            isValidParentChildRelation({
                parentType: DestinationTypeEnum.CITY,
                childType: DestinationTypeEnum.COUNTRY
            })
        ).toBe(false);
    });

    it('should return false for same level (CITY -> CITY)', () => {
        expect(
            isValidParentChildRelation({
                parentType: DestinationTypeEnum.CITY,
                childType: DestinationTypeEnum.CITY
            })
        ).toBe(false);
    });

    it('should return false for REGION -> DEPARTMENT (skip one level)', () => {
        expect(
            isValidParentChildRelation({
                parentType: DestinationTypeEnum.REGION,
                childType: DestinationTypeEnum.DEPARTMENT
            })
        ).toBe(false);
    });
});
