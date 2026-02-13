import {
    DESTINATION_TYPE_LEVELS,
    type DestinationType,
    type DestinationTypeEnum
} from '@repo/schemas';

/**
 * Validates that a destination type matches the expected level.
 * @param params - The destination type and level to validate
 * @returns true if the type matches the expected level
 */
export function validateDestinationTypeLevel({
    destinationType,
    level
}: {
    destinationType: DestinationType;
    level: number;
}): boolean {
    return DESTINATION_TYPE_LEVELS[destinationType as DestinationTypeEnum] === level;
}

/**
 * Gets the expected parent destination type for a given type.
 * Returns null for COUNTRY (top-level, no parent).
 * @param params - The child destination type
 * @returns The expected parent type or null
 */
export function getExpectedParentType({
    destinationType
}: {
    destinationType: DestinationType;
}): DestinationType | null {
    const level = DESTINATION_TYPE_LEVELS[destinationType as DestinationTypeEnum];
    if (level === 0) {
        return null;
    }

    const entries = Object.entries(DESTINATION_TYPE_LEVELS) as [DestinationType, number][];
    const parentEntry = entries.find(([, l]) => l === level - 1);
    return parentEntry ? parentEntry[0] : null;
}

/**
 * Computes the materialized path for a destination.
 * @param params - The parent path (or empty for root) and the slug
 * @returns The computed materialized path
 */
export function computeHierarchyPath({
    parentPath,
    slug
}: {
    parentPath: string | null;
    slug: string;
}): string {
    if (!parentPath) {
        return `/${slug}`;
    }
    return `${parentPath}/${slug}`;
}

/**
 * Computes the pathIds field for a destination.
 * pathIds contains all ancestor IDs separated by '/' (e.g., 'uuid1/uuid2/uuid3').
 * @param params - The parent pathIds and the parent ID
 * @returns The computed pathIds string
 */
export function computeHierarchyPathIds({
    parentPathIds,
    parentId
}: {
    parentPathIds: string | null;
    parentId: string | null;
}): string {
    if (!parentId) {
        return '';
    }
    if (!parentPathIds || parentPathIds === '') {
        return parentId;
    }
    return `${parentPathIds}/${parentId}`;
}

/**
 * Computes the level for a destination based on its parent.
 * @param params - The parent level (or null for root)
 * @returns The computed level
 */
export function computeHierarchyLevel({
    parentLevel
}: {
    parentLevel: number | null;
}): number {
    if (parentLevel === null || parentLevel === undefined) {
        return 0;
    }
    return parentLevel + 1;
}

/**
 * Validates that a parent-child relationship is valid.
 * Checks that the child type is one level below the parent type.
 * @param params - The parent and child destination types
 * @returns true if the relationship is valid
 */
export function isValidParentChildRelation({
    parentType,
    childType
}: {
    parentType: DestinationType;
    childType: DestinationType;
}): boolean {
    const parentLevel = DESTINATION_TYPE_LEVELS[parentType as DestinationTypeEnum];
    const childLevel = DESTINATION_TYPE_LEVELS[childType as DestinationTypeEnum];
    return childLevel === parentLevel + 1;
}
