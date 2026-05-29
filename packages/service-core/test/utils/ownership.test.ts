/**
 * @fileoverview
 * Test suite for the per-entity ownership resolver (SPEC-169 §5.6).
 * Verifies the descriptor shape, the isOwner predicate, and that the registry stays
 * minimal (only owner-scoped entities — decision D1/D3: accommodation only).
 */
import { RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import type { Actor } from '../../src/types';
import { OWNERSHIP_REGISTRY, getOwnershipDescriptor } from '../../src/utils/ownership';

const makeActor = (id: string): Actor => ({
    id,
    role: RoleEnum.HOST,
    permissions: []
});

describe('ownership resolver (SPEC-169 §5.6)', () => {
    it('returns the accommodation descriptor with ownerColumn "ownerId"', () => {
        const descriptor = getOwnershipDescriptor('accommodation');
        expect(descriptor).toBeDefined();
        expect(descriptor?.ownerColumn).toBe('ownerId');
    });

    it('isOwner is true when entity[ownerColumn] === actor.id', () => {
        const descriptor = getOwnershipDescriptor('accommodation');
        expect(descriptor?.isOwner(makeActor('u1'), { ownerId: 'u1' })).toBe(true);
    });

    it('isOwner is false when entity[ownerColumn] !== actor.id', () => {
        const descriptor = getOwnershipDescriptor('accommodation');
        expect(descriptor?.isOwner(makeActor('u1'), { ownerId: 'u2' })).toBe(false);
    });

    it('isOwner is false when the owner column is missing or null', () => {
        const descriptor = getOwnershipDescriptor('accommodation');
        expect(descriptor?.isOwner(makeActor('u1'), {})).toBe(false);
        expect(descriptor?.isOwner(makeActor('u1'), { ownerId: null })).toBe(false);
        expect(descriptor?.isOwner(makeActor('u1'), { ownerId: 123 })).toBe(false);
    });

    it('returns undefined for entities that are not owner-scoped', () => {
        expect(getOwnershipDescriptor('post')).toBeUndefined();
        expect(getOwnershipDescriptor('destination')).toBeUndefined();
        expect(getOwnershipDescriptor('unknown-entity')).toBeUndefined();
    });

    it('keeps the registry minimal — only accommodation (decision D1/D3, YAGNI)', () => {
        expect(Object.keys(OWNERSHIP_REGISTRY)).toEqual(['accommodation']);
    });
});
