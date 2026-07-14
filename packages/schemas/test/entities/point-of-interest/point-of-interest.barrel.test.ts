/**
 * Barrel export smoke test (HOS-113 T-013, AC-2)
 *
 * Asserts the full point-of-interest 6-file schema set is importable both
 * from the entity's own barrel and from the top-level `@repo/schemas`
 * package entry point.
 */
import { describe, expect, it } from 'vitest';
import * as PointOfInterestEntityBarrel from '../../../src/entities/point-of-interest/index.js';
import * as RepoSchemas from '../../../src/index.js';

const EXPECTED_EXPORTS = [
    // point-of-interest.schema.ts
    'PointOfInterestSchema',
    'PointOfInterestSummarySchema',
    'PointOfInterestMiniSchema',
    // point-of-interest.crud.schema.ts
    'PointOfInterestCreateInputSchema',
    'PointOfInterestUpdateInputSchema',
    'PointOfInterestDeleteInputSchema',
    'PointOfInterestRestoreInputSchema',
    'PointOfInterestAddToDestinationInputSchema',
    'PointOfInterestRemoveFromDestinationInputSchema',
    // point-of-interest.query.schema.ts
    'PointOfInterestFiltersSchema',
    'PointOfInterestSearchSchema',
    'DestinationIdsByPointOfInterestSlugsSchema',
    'HttpPointOfInterestSearchSchema',
    // point-of-interest.http.schema.ts
    'PointOfInterestSearchHttpSchema',
    'PointOfInterestCreateHttpSchema',
    'httpToDomainPointOfInterestSearch',
    'httpToDomainPointOfInterestCreate',
    'httpToDomainPointOfInterestUpdate',
    // point-of-interest.access.schema.ts
    'PointOfInterestPublicSchema',
    'PointOfInterestProtectedSchema',
    'PointOfInterestAdminSchema',
    // point-of-interest.relations.schema.ts
    'DestinationPointOfInterestRelationSchema',
    'PointOfInterestWithDestinationsSchema',
    'PointOfInterestBulkRelationOperationOutputSchema',
    // point-of-interest.admin-search.schema.ts (HOS-143 T-001)
    'PointOfInterestAdminSearchSchema',
    // point-of-interest.batch.schema.ts (HOS-143 T-002)
    'PointOfInterestBatchRequestSchema',
    'PointOfInterestBatchItemSchema',
    'PointOfInterestBatchResponseSchema',
    // point-of-interest.destination-relation.schema.ts (HOS-143 T-003)
    'PointOfInterestUpdateDestinationRelationInputSchema',
    'PointOfInterestDestinationListItemSchema',
    // point-of-interest.category-assignment.schema.ts (HOS-143 T-004)
    'PointOfInterestSetCategoriesInputSchema',
    'PointOfInterestCategoryAssignmentSchema'
] as const;

describe('point-of-interest schemas barrel (HOS-113 T-013)', () => {
    it.each(EXPECTED_EXPORTS)('should export %s from the entity barrel', (exportName) => {
        expect(PointOfInterestEntityBarrel).toHaveProperty(exportName);
        expect((PointOfInterestEntityBarrel as Record<string, unknown>)[exportName]).toBeDefined();
    });

    it.each(
        EXPECTED_EXPORTS
    )('should export %s from the @repo/schemas package root', (exportName) => {
        expect(RepoSchemas).toHaveProperty(exportName);
        expect((RepoSchemas as Record<string, unknown>)[exportName]).toBeDefined();
    });

    it('should export the PointOfInterestTypeEnum from the package root (enums barrel)', () => {
        expect(RepoSchemas).toHaveProperty('PointOfInterestTypeEnum');
        expect(RepoSchemas).toHaveProperty('PointOfInterestTypeEnumSchema');
    });
});
