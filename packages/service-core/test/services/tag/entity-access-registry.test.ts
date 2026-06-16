/**
 * @file entity-access-registry.test.ts
 *
 * Unit tests for EntityAccessRegistry and getCanViewChecker.
 *
 * Covers uncovered lines from v8 report:
 *   - stubChecker body (lines 55-64): the returned async function logs a warning and returns true
 *   - getCanViewChecker fallback branch (lines 110-116): when entityType has no checker, falls back to stub
 */

import { EntityTypeEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    EntityAccessRegistry,
    getCanViewChecker
} from '../../../src/services/tag/entity-access-registry';
import { createActor } from '../../factories/actorFactory';

describe('EntityAccessRegistry — stubChecker', () => {
    it('should return true (permissive) for a registered entity type', async () => {
        // Arrange — any registered entity type exercises the stub body
        const actor = createActor({});
        const checker = EntityAccessRegistry[EntityTypeEnum.ACCOMMODATION];

        // Act
        const result = await checker('some-entity-id', actor);

        // Assert — stub is permissive: always true
        expect(result).toBe(true);
    });

    it('should return true for DESTINATION entity type', async () => {
        const actor = createActor({});
        const checker = EntityAccessRegistry[EntityTypeEnum.DESTINATION];
        const result = await checker('dest-id', actor);
        expect(result).toBe(true);
    });

    it('should return true for EVENT entity type', async () => {
        const actor = createActor({});
        const checker = EntityAccessRegistry[EntityTypeEnum.EVENT];
        const result = await checker('event-id', actor);
        expect(result).toBe(true);
    });

    it('should return true for POST entity type', async () => {
        const actor = createActor({});
        const checker = EntityAccessRegistry[EntityTypeEnum.POST];
        const result = await checker('post-id', actor);
        expect(result).toBe(true);
    });
});

describe('getCanViewChecker', () => {
    it('should return the registered stub for a known entity type', async () => {
        // Arrange
        const actor = createActor({});

        // Act
        const checker = getCanViewChecker(EntityTypeEnum.USER);
        const result = await checker('user-id', actor);

        // Assert
        expect(result).toBe(true);
    });

    it('should fall back to a permissive stub when entity type is not in registry', async () => {
        // Arrange — inject a type not in EntityTypeEnum at runtime
        const actor = createActor({});
        const unknownType = 'UNKNOWN_TYPE_XYZ' as unknown as EntityTypeEnum;

        // Act — getCanViewChecker defensive fallback handles unknown types
        const checker = getCanViewChecker(unknownType);
        const result = await checker('some-id', actor);

        // Assert — fallback stub is also permissive
        expect(result).toBe(true);
    });

    it('should return a callable function for every registered EntityTypeEnum value', async () => {
        // Arrange
        const actor = createActor({});
        const knownTypes = Object.values(EntityTypeEnum);

        // Act + Assert — all registered types return a working checker
        for (const entityType of knownTypes) {
            const checker = getCanViewChecker(entityType);
            expect(typeof checker).toBe('function');
            const result = await checker('entity-id', actor);
            expect(result).toBe(true);
        }
    });
});

describe('EntityAccessRegistry — all entity types registered', () => {
    it('should have an entry for every EntityTypeEnum value', () => {
        const allTypes = Object.values(EntityTypeEnum);
        for (const entityType of allTypes) {
            expect(EntityAccessRegistry[entityType]).toBeDefined();
            expect(typeof EntityAccessRegistry[entityType]).toBe('function');
        }
    });
});

describe('EntityAccessRegistry — replacement', () => {
    it('should allow replacing a checker and restoring it (registry is mutable)', async () => {
        // Arrange — save original stub, replace with a custom checker
        const original = EntityAccessRegistry[EntityTypeEnum.ACCOMMODATION];
        const customChecker = vi.fn().mockResolvedValue(false);
        EntityAccessRegistry[EntityTypeEnum.ACCOMMODATION] = customChecker;

        const actor = createActor({});

        // Act
        const result = await EntityAccessRegistry[EntityTypeEnum.ACCOMMODATION]('acc-id', actor);

        // Assert — custom checker was called
        expect(customChecker).toHaveBeenCalledWith('acc-id', actor);
        expect(result).toBe(false);

        // Teardown — restore original so other tests are unaffected
        EntityAccessRegistry[EntityTypeEnum.ACCOMMODATION] = original;
    });
});
