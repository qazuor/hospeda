/**
 * Unit tests for the owner-act register (HOS-1499, piece V9a): the content /
 * non-content split of "what changed", the owner-only rule and the correlation
 * fallback. The DB write itself is covered by
 * `test/integration/services/listing-owner-act.integration.test.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/db', async (importOriginal) => {
    const doubles = await import('../../helpers/owner-act-doubles');
    return {
        ...(await importOriginal<object>()),
        domainEventModel: doubles.domainEventModelDouble
    };
});

import {
    buildListingOwnerActChanges,
    LISTING_NON_CONTENT_FIELDS,
    recordListingOwnerAct
} from '../../../src/services/listing/listing-owner-act';
import type { Actor } from '../../../src/types';
import {
    _resetCorrelationIdResolver,
    resolveServiceCorrelationId,
    setCorrelationIdResolver
} from '../../../src/utils/correlation';
import { domainEventModelDouble } from '../../helpers/owner-act-doubles';

const OWNER_ID = '00000000-0000-4000-a000-000000000001';
const OTHER_ID = '00000000-0000-4000-a000-000000000002';
const LISTING_ID = '00000000-0000-4000-a000-000000000003';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const actor = (id: string): Actor => ({ id, roles: [], permissions: [] });

beforeEach(() => {
    domainEventModelDouble.writes.length = 0;
});

afterEach(() => {
    _resetCorrelationIdResolver();
});

describe('buildListingOwnerActChanges', () => {
    // TEST:V9a:2 (unit) — AC:V9a:2
    it('keeps only the NAME of a content field and old/new of a state field', () => {
        const { changes } = buildListingOwnerActChanges({
            before: { description: 'texto viejo', lifecycleState: 'ACTIVE' },
            payload: { description: 'texto nuevo', lifecycleState: 'INACTIVE' }
        });

        expect(changes).toEqual([
            { field: 'description' },
            { field: 'lifecycleState', old: 'ACTIVE', new: 'INACTIVE' }
        ]);
        expect(JSON.stringify(changes)).not.toContain('texto');
    });

    it('treats any field outside the closed non-content list as content (fail-closed)', () => {
        const { changes } = buildListingOwnerActChanges({
            before: { slug: 'nombre-viejo', openingHours: { mon: '9-18' } },
            payload: { slug: 'nombre-nuevo', openingHours: { mon: '10-20' } }
        });

        expect(changes).toEqual([{ field: 'openingHours' }, { field: 'slug' }]);
    });

    it('stores every non-content field in the closed list with its values', () => {
        const at = new Date('2026-10-07T12:00:00.000Z');
        for (const field of LISTING_NON_CONTENT_FIELDS) {
            const { changes } = buildListingOwnerActChanges({
                before: { [field]: null },
                payload: { [field]: at }
            });
            expect(changes).toEqual([{ field, old: null, new: at.toISOString() }]);
        }
    });

    it('omits unchanged fields and bookkeeping keys on an edit', () => {
        const { changes } = buildListingOwnerActChanges({
            before: { summary: 'igual', visibility: 'PUBLIC' },
            payload: {
                summary: 'igual',
                visibility: 'PUBLIC',
                updatedById: OWNER_ID,
                refreshSlugFromName: true
            }
        });

        expect(changes).toEqual([]);
    });

    it('always lists write-only junction keys by name', () => {
        const { changes } = buildListingOwnerActChanges({
            before: {},
            payload: { amenityIds: ['a'], featureIds: [] }
        });

        expect(changes).toEqual([{ field: 'amenityIds' }, { field: 'featureIds' }]);
    });

    it('on a create, stores the new value of a state field and no old one', () => {
        const { changes } = buildListingOwnerActChanges({
            payload: { name: 'Mi ficha', lifecycleState: 'DRAFT' }
        });

        expect(changes).toEqual([{ field: 'lifecycleState', new: 'DRAFT' }, { field: 'name' }]);
    });
});

describe('recordListingOwnerAct', () => {
    // TEST:V9a:1 (unit) — AC:V9a:1
    it('writes the event with the minimum fields when the actor is the owner', async () => {
        const result = await recordListingOwnerAct({
            eventType: 'listing.edited',
            entityType: 'accommodation',
            listing: { id: LISTING_ID, ownerId: OWNER_ID },
            actor: actor(OWNER_ID),
            ctx: { correlationId: '11111111-1111-4111-8111-111111111111' },
            changes: [{ field: 'description' }]
        });

        expect(result.recorded).toBe(true);
        expect(domainEventModelDouble.writes).toEqual([
            {
                eventType: 'listing.edited',
                entityType: 'accommodation',
                entityId: LISTING_ID,
                actorId: OWNER_ID,
                actorType: 'owner',
                correlationId: '11111111-1111-4111-8111-111111111111',
                changes: [{ field: 'description' }]
            }
        ]);
    });

    it('writes nothing when the actor is not the owner', async () => {
        const result = await recordListingOwnerAct({
            eventType: 'listing.edited',
            entityType: 'gastronomy',
            listing: { id: LISTING_ID, ownerId: OWNER_ID },
            actor: actor(OTHER_ID),
            changes: []
        });

        expect(result.recorded).toBe(false);
        expect(domainEventModelDouble.writes).toEqual([]);
    });

    it('writes nothing for a listing without an owner', async () => {
        const result = await recordListingOwnerAct({
            eventType: 'listing.created',
            entityType: 'experience',
            listing: { id: LISTING_ID, ownerId: null },
            actor: actor(OWNER_ID),
            changes: []
        });

        expect(result.recorded).toBe(false);
        expect(domainEventModelDouble.writes).toEqual([]);
    });
});

describe('resolveServiceCorrelationId', () => {
    it('prefers the context, then the wired resolver, then mints one', () => {
        setCorrelationIdResolver(() => '22222222-2222-4222-8222-222222222222');

        expect(
            resolveServiceCorrelationId({
                ctx: { correlationId: '11111111-1111-4111-8111-111111111111' }
            }).correlationId
        ).toBe('11111111-1111-4111-8111-111111111111');
        expect(resolveServiceCorrelationId({ ctx: {} }).correlationId).toBe(
            '22222222-2222-4222-8222-222222222222'
        );

        _resetCorrelationIdResolver();
        expect(resolveServiceCorrelationId({}).correlationId).toMatch(UUID_RE);
    });
});
