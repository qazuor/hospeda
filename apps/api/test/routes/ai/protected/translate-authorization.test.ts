/**
 * Unit tests for the protected translate route's authorization policy (HOS-584).
 *
 * The policy is a pure function precisely so it can be exercised here without a
 * database, a Hono context or an AI stub. The route-level proof that the policy
 * is actually WIRED lives in `test/integration/ai/translate.test.ts` — a green
 * suite here says the rule is right, not that anyone applies it.
 *
 * @module test/routes/ai/protected/translate-authorization
 */

import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    mayTranslateEntity,
    PROTECTED_TRANSLATABLE_ENTITY_TYPES
} from '../../../../src/routes/ai/protected/translate.authorization';
import type { TranslationEntityOwnership } from '../../../../src/services/ai-translate.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACTOR_ID = '22222222-2222-4222-2222-222222222222';
const STRANGER_ID = '99999999-9999-4999-8999-999999999999';

/** An ownership projection with every column empty unless overridden. */
function ownership(
    overrides: Partial<TranslationEntityOwnership> = {}
): TranslationEntityOwnership {
    return { ownerId: null, authorId: null, createdById: null, ...overrides };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('mayTranslateEntity — accommodation', () => {
    it('allows the owner', () => {
        const allowed = mayTranslateEntity({
            entityType: 'accommodation',
            ownership: ownership({ ownerId: ACTOR_ID }),
            actorId: ACTOR_ID,
            actorPermissions: []
        });

        expect(allowed).toBe(true);
    });

    it('allows the creator when ownerId belongs to someone else', () => {
        // Mirrors the accommodation PATCH route, whose ownership config is
        // `['ownerId', 'createdById']` — the two must agree, or a host could
        // edit a row through PATCH that this route refuses to translate.
        const allowed = mayTranslateEntity({
            entityType: 'accommodation',
            ownership: ownership({ ownerId: STRANGER_ID, createdById: ACTOR_ID }),
            actorId: ACTOR_ID,
            actorPermissions: []
        });

        expect(allowed).toBe(true);
    });

    it('denies a stranger', () => {
        const allowed = mayTranslateEntity({
            entityType: 'accommodation',
            ownership: ownership({ ownerId: STRANGER_ID, createdById: STRANGER_ID }),
            actorId: ACTOR_ID,
            actorPermissions: []
        });

        expect(allowed).toBe(false);
    });

    it('allows a stranger holding ACCOMMODATION_UPDATE_ANY', () => {
        const allowed = mayTranslateEntity({
            entityType: 'accommodation',
            ownership: ownership({ ownerId: STRANGER_ID }),
            actorId: ACTOR_ID,
            actorPermissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY]
        });

        expect(allowed).toBe(true);
    });

    it('denies a stranger holding an unrelated bypass permission', () => {
        // Non-vacuous companion to the test above: it proves the bypass is keyed
        // on the entity's own permission rather than on holding any permission.
        const allowed = mayTranslateEntity({
            entityType: 'accommodation',
            ownership: ownership({ ownerId: STRANGER_ID }),
            actorId: ACTOR_ID,
            actorPermissions: [PermissionEnum.DESTINATION_UPDATE, PermissionEnum.POST_UPDATE]
        });

        expect(allowed).toBe(false);
    });
});

describe('mayTranslateEntity — event and post', () => {
    it('allows the author of an event', () => {
        const allowed = mayTranslateEntity({
            entityType: 'event',
            ownership: ownership({ authorId: ACTOR_ID }),
            actorId: ACTOR_ID,
            actorPermissions: []
        });

        expect(allowed).toBe(true);
    });

    it('denies an event authored by someone else', () => {
        const allowed = mayTranslateEntity({
            entityType: 'event',
            ownership: ownership({ authorId: STRANGER_ID, createdById: STRANGER_ID }),
            actorId: ACTOR_ID,
            actorPermissions: []
        });

        expect(allowed).toBe(false);
    });

    it('allows a stranger holding EVENT_UPDATE', () => {
        const allowed = mayTranslateEntity({
            entityType: 'event',
            ownership: ownership({ authorId: STRANGER_ID }),
            actorId: ACTOR_ID,
            actorPermissions: [PermissionEnum.EVENT_UPDATE]
        });

        expect(allowed).toBe(true);
    });

    it('allows the author of a post', () => {
        const allowed = mayTranslateEntity({
            entityType: 'post',
            ownership: ownership({ authorId: ACTOR_ID }),
            actorId: ACTOR_ID,
            actorPermissions: []
        });

        expect(allowed).toBe(true);
    });

    it('denies a post authored by someone else', () => {
        const allowed = mayTranslateEntity({
            entityType: 'post',
            ownership: ownership({ authorId: STRANGER_ID, createdById: STRANGER_ID }),
            actorId: ACTOR_ID,
            actorPermissions: []
        });

        expect(allowed).toBe(false);
    });

    it('allows a stranger holding POST_UPDATE', () => {
        const allowed = mayTranslateEntity({
            entityType: 'post',
            ownership: ownership({ authorId: STRANGER_ID }),
            actorId: ACTOR_ID,
            actorPermissions: [PermissionEnum.POST_UPDATE]
        });

        expect(allowed).toBe(true);
    });
});

describe('mayTranslateEntity — destination', () => {
    it('denies an authenticated actor with no permission', () => {
        // A destination has no owner column at all: it is staff-managed content.
        // "Nobody owns it" must resolve to nobody-by-default, not everybody.
        const allowed = mayTranslateEntity({
            entityType: 'destination',
            ownership: ownership(),
            actorId: ACTOR_ID,
            actorPermissions: []
        });

        expect(allowed).toBe(false);
    });

    it('denies an actor who merely created the row', () => {
        // `createdById` is deliberately NOT an ownership field for destinations.
        // Staff content stays permission-gated even for whoever seeded it.
        const allowed = mayTranslateEntity({
            entityType: 'destination',
            ownership: ownership({ createdById: ACTOR_ID }),
            actorId: ACTOR_ID,
            actorPermissions: []
        });

        expect(allowed).toBe(false);
    });

    it('allows an actor holding DESTINATION_UPDATE', () => {
        const allowed = mayTranslateEntity({
            entityType: 'destination',
            ownership: ownership(),
            actorId: ACTOR_ID,
            actorPermissions: [PermissionEnum.DESTINATION_UPDATE]
        });

        expect(allowed).toBe(true);
    });
});

describe('mayTranslateEntity — degenerate inputs', () => {
    it('denies when every ownership column is empty', () => {
        // The pre-fix row shape: nothing on the row ties it to anyone. A policy
        // that compared `null === undefined` loosely, or treated "no owner" as
        // "open", would hand write access to every authenticated user.
        for (const entityType of PROTECTED_TRANSLATABLE_ENTITY_TYPES) {
            expect(
                mayTranslateEntity({
                    entityType,
                    ownership: ownership(),
                    actorId: ACTOR_ID,
                    actorPermissions: []
                })
            ).toBe(false);
        }
    });

    it('denies when the actor id is empty', () => {
        // An unresolved actor id must never match an unset column.
        const allowed = mayTranslateEntity({
            entityType: 'accommodation',
            ownership: ownership({ ownerId: '' }),
            actorId: '',
            actorPermissions: []
        });

        expect(allowed).toBe(false);
    });
});

describe('PROTECTED_TRANSLATABLE_ENTITY_TYPES', () => {
    it('does not include pointOfInterest', () => {
        // The service's `TranslatableEntityType` has five members; the protected
        // route accepts four. POIs are a staff-curated catalog with no
        // owner-facing editor, so they are translated through the admin route.
        expect(PROTECTED_TRANSLATABLE_ENTITY_TYPES).not.toContain('pointOfInterest');
    });

    it('lists exactly the four owner-reachable content types', () => {
        expect([...PROTECTED_TRANSLATABLE_ENTITY_TYPES]).toEqual([
            'accommodation',
            'destination',
            'event',
            'post'
        ]);
    });
});
