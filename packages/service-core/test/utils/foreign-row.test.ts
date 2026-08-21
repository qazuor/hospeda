/**
 * The three cases {@link maskForeignRowRefusal} must NOT rewrite, plus the one
 * it must (HOS-706).
 *
 * The static guard next door proves the write pipeline routes its permission
 * hooks through the mask. It cannot prove the mask decides correctly — a mask
 * that rewrote every 403 would satisfy it and would answer "not found" to an
 * owner who was refused for a reason about the row's STATE ("your subscription
 * is paused", "this event is published"). That is what these assertions pin.
 */

import { ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import type { Actor } from '../../src/types';
import { ServiceError } from '../../src/types';
import { maskForeignRowRefusal, WRITE_PATH_OWNER_FIELDS } from '../../src/utils/foreign-row';

const ACTOR = { id: 'actor-1', roles: [], permissions: [] } as unknown as Actor;
const REFUSAL = new ServiceError(ServiceErrorCode.FORBIDDEN, 'Permission denied to update thing');

const mask = (entity: unknown, error: unknown = REFUSAL) =>
    maskForeignRowRefusal({ error, actor: ACTOR, entity, entityName: 'thing' });

describe('maskForeignRowRefusal', () => {
    it('rewrites a refusal on a foreign row into the canonical not-found error', () => {
        const masked = mask({ id: 'row-1', ownerId: 'someone-else' });

        expect(masked).toBeInstanceOf(ServiceError);
        expect((masked as ServiceError).code).toBe(ServiceErrorCode.NOT_FOUND);
        // Byte-identical to what `validateEntity` composes for a missing row —
        // a different message would leak exactly what the matching status hides.
        expect((masked as ServiceError).message).toBe('thing not found');
    });

    it.each(WRITE_PATH_OWNER_FIELDS)('recognises `%s` as the owner column', (field) => {
        expect((mask({ id: 'row-1', [field]: 'someone-else' }) as ServiceError).code).toBe(
            ServiceErrorCode.NOT_FOUND
        );
        expect((mask({ id: 'row-1', [field]: ACTOR.id }) as ServiceError).code).toBe(
            ServiceErrorCode.FORBIDDEN
        );
    });

    it('leaves a refusal aimed at the row OWNER untouched', () => {
        // The owner already knows the row exists. Masking here would replace an
        // actionable reason with a lie.
        expect(mask({ id: 'row-1', ownerId: ACTOR.id })).toBe(REFUSAL);
    });

    it('leaves a refusal on an owner-less row untouched', () => {
        // Catalog rows (amenity, destination, partner, ...) have no ownership
        // dimension, so their 403 discloses nothing to an admin-tier caller.
        expect(mask({ id: 'row-1', name: 'a catalog row' })).toBe(REFUSAL);
    });

    it('leaves a non-FORBIDDEN ServiceError untouched', () => {
        const unauthorized = new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Actor is required');
        expect(mask({ id: 'row-1', ownerId: 'someone-else' }, unauthorized)).toBe(unauthorized);
    });

    it('leaves a plain Error untouched', () => {
        // A non-ServiceError is a bug, not a policy decision; rewriting it into
        // a 404 would bury it.
        const bug = new Error('boom');
        expect(mask({ id: 'row-1', ownerId: 'someone-else' }, bug)).toBe(bug);
    });

    it('treats a null or non-string owner column as owner-less', () => {
        expect(mask({ id: 'row-1', ownerId: null })).toBe(REFUSAL);
        expect(mask({ id: 'row-1', ownerId: '' })).toBe(REFUSAL);
        expect(mask(null)).toBe(REFUSAL);
    });

    it('does not treat `id` as an owner column', () => {
        // Every row has one. Including it would classify every owner-less row as
        // foreign and turn ordinary admin permission refusals into 404s.
        expect(mask({ id: 'row-1' })).toBe(REFUSAL);
    });
});
