/**
 * Unit tests for the owner-act register (HOS-1499, piece V9a): the content /
 * non-content split of "what changed", the owner-only rule and the correlation
 * fallback. The DB write itself is covered by
 * `test/integration/services/listing-owner-act.integration.test.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const outbox = vi.hoisted(() => ({
    calls: [] as { input: Record<string, unknown>; tx: unknown }[]
}));

vi.mock('@repo/db', async (importOriginal) => {
    const doubles = await import('../../helpers/owner-act-doubles');
    return {
        ...(await importOriginal<object>()),
        domainEventModel: doubles.domainEventModelDouble,
        emailOutboxModel: {
            async enqueue(input: Record<string, unknown>, tx?: unknown) {
                outbox.calls.push({ input, tx });
                return { enqueued: true };
            }
        }
    };
});

import { PermissionEnum } from '@repo/schemas';

import {
    buildListingOwnerActChanges,
    LISTING_NON_CONTENT_FIELDS,
    type ListingOwnerActEntityType,
    type ListingSubEntityField,
    recordListingOwnerAct,
    recordListingSubEntityEdit
} from '../../../src/services/listing/listing-owner-act';
import type { Actor, ServiceContext } from '../../../src/types';
import { runWithAdministrativeAuthorization } from '../../../src/utils/administrative-authorization';
import {
    _resetCorrelationIdResolver,
    resolveServiceCorrelationId,
    setCorrelationIdResolver
} from '../../../src/utils/correlation';
import { domainEventModelDouble, FAKE_SERVICE_TX } from '../../helpers/owner-act-doubles';

const OWNER_ID = '00000000-0000-4000-a000-000000000001';
const OTHER_ID = '00000000-0000-4000-a000-000000000002';
const LISTING_ID = '00000000-0000-4000-a000-000000000003';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const actor = (id: string): Actor => ({ id, roles: [], permissions: [] });
/** A foreign actor holding action 15's own permission (ACC:15, HOS-1493). */
const admin15: Actor = {
    id: OTHER_ID,
    roles: [],
    permissions: [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT]
};
/** A fake tx answering the owner-email read of the support-edit register. */
const fakeEmailTx = (): ServiceContext['tx'] => {
    const chain = {
        select: () => chain,
        from: () => chain,
        where: () => chain,
        limit: async () => [{ email: 'duena@example.com' }]
    };
    return chain as unknown as ServiceContext['tx'];
};

/** Runs `run` inside the action-15 scope a route opens for the owner. */
const inOwnerScope = <T>(run: () => Promise<T>): Promise<T> =>
    runWithAdministrativeAuthorization({
        authorization: { action: 'ACC_15', subjectId: OWNER_ID },
        run
    });

beforeEach(() => {
    domainEventModelDouble.writes.length = 0;
    outbox.calls.length = 0;
});

afterEach(() => {
    _resetCorrelationIdResolver();
});

describe('buildListingOwnerActChanges', () => {
    // TEST:V9a:2 (unit) — AC:V9a:2
    it('keeps only the NAME of a content field and old/new of a state field', () => {
        const { changes } = buildListingOwnerActChanges({
            before: { description: 'texto viejo', publicationStatus: 'PUBLISHED' },
            payload: { description: 'texto nuevo', publicationStatus: 'DRAFT' }
        });

        expect(changes).toEqual([
            { field: 'description' },
            { field: 'publicationStatus', old: 'PUBLISHED', new: 'DRAFT' }
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
            before: { summary: 'igual', publicationStatus: 'PUBLISHED' },
            payload: {
                summary: 'igual',
                publicationStatus: 'PUBLISHED',
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
            payload: { name: 'Mi ficha', publicationStatus: 'DRAFT' }
        });

        expect(changes).toEqual([{ field: 'name' }, { field: 'publicationStatus', new: 'DRAFT' }]);
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

    it('writes nothing for a foreign actor outside an action 15 scope', async () => {
        const result = await recordListingOwnerAct({
            eventType: 'listing.edited',
            entityType: 'venue',
            listing: { id: LISTING_ID, ownerId: OWNER_ID },
            actor: actor(OTHER_ID),
            changes: []
        });

        expect(result.recorded).toBe(false);
        expect(domainEventModelDouble.writes).toEqual([]);
        expect(outbox.calls).toEqual([]);
    });

    it('delegates an authorized action 15 (scope bound to the owner) to the support register', async () => {
        const tx = fakeEmailTx();
        const result = await inOwnerScope(() =>
            recordListingOwnerAct({
                eventType: 'listing.edited',
                entityType: 'venue',
                listing: { id: LISTING_ID, ownerId: OWNER_ID },
                actor: admin15,
                ctx: { tx },
                changes: [{ field: 'description' }]
            })
        );

        expect(result.recorded).toBe(true);
        expect(domainEventModelDouble.writes).toHaveLength(1);
        expect(domainEventModelDouble.writes[0]).toMatchObject({
            actorId: OTHER_ID,
            actorType: 'admin',
            changes: [{ field: 'description' }]
        });
        expect(outbox.calls).toHaveLength(1);
        expect(outbox.calls[0]?.tx).toBe(tx);
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

describe('recordListingSubEntityEdit', () => {
    // TEST:V9a:6 (unit) — AC:V9a:6 / AC:V9a:7

    const ALL_FIELDS: readonly ListingSubEntityField[] = [
        'faqs',
        'media',
        'menu',
        'dailySpecials',
        'events',
        'certificates',
        'tags'
    ];

    it('records one listing.edited event carrying only the field name', async () => {
        const result = await recordListingSubEntityEdit({
            entityType: 'accommodation',
            listing: { id: LISTING_ID, ownerId: OWNER_ID },
            actor: actor(OWNER_ID),
            field: 'faqs',
            ctx: { correlationId: '11111111-1111-4111-8111-111111111111' }
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
                changes: [{ field: 'faqs' }]
            }
        ]);
    });

    it.each(
        ALL_FIELDS
    )('carries the field name "%s" and nothing else in changes', async (field) => {
        const result = await recordListingSubEntityEdit({
            entityType: 'venue' satisfies ListingOwnerActEntityType,
            listing: { id: LISTING_ID, ownerId: OWNER_ID },
            actor: actor(OWNER_ID),
            field
        });

        expect(result.recorded).toBe(true);
        expect(domainEventModelDouble.writes).toHaveLength(1);
        const write = domainEventModelDouble.writes[0];
        expect(write?.eventType).toBe('listing.edited');
        expect(write?.changes).toEqual([{ field }]);
        // The name-only guarantee: no old/new values, no content.
        expect(JSON.stringify(write)).not.toContain('old');
        expect(JSON.stringify(write)).not.toContain('new');
    });

    it('writes nothing for a foreign actor outside an action 15 scope', async () => {
        const result = await recordListingSubEntityEdit({
            entityType: 'experience',
            listing: { id: LISTING_ID, ownerId: OWNER_ID },
            actor: actor(OTHER_ID),
            field: 'media'
        });

        expect(result.recorded).toBe(false);
        expect(domainEventModelDouble.writes).toEqual([]);
    });

    it('delegates an authorized action 15 sub-entity edit (photos part)', async () => {
        const result = await inOwnerScope(() =>
            recordListingSubEntityEdit({
                entityType: 'experience',
                listing: { id: LISTING_ID, ownerId: OWNER_ID },
                actor: admin15,
                field: 'media',
                ctx: { tx: fakeEmailTx() }
            })
        );

        expect(result.recorded).toBe(true);
        expect(domainEventModelDouble.writes[0]).toMatchObject({
            actorType: 'admin',
            changes: [{ field: 'media' }]
        });
        expect(outbox.calls[0]?.input.payload).toMatchObject({ parts: ['photos'] });
    });

    it('passes ctx.tx through so the event joins the write transaction', async () => {
        const result = await recordListingSubEntityEdit({
            entityType: 'accommodation',
            listing: { id: LISTING_ID, ownerId: OWNER_ID },
            actor: actor(OWNER_ID),
            field: 'media',
            ctx: { tx: FAKE_SERVICE_TX as unknown as ServiceContext['tx'] }
        });

        expect(result.recorded).toBe(true);
        expect(domainEventModelDouble.writes).toHaveLength(1);
        expect(domainEventModelDouble.writes[0]?.tx).toBe(FAKE_SERVICE_TX);
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
