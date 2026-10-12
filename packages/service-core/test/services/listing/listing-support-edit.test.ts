/**
 * Unit tests for the support-edit register (ACC:15, HOS-1493): the parts of a
 * listing an edit touched, when a write is action 15, and the event + email it
 * records inside the write's transaction. The DB write itself is covered by
 * `test/integration/services/listing-support-edit.integration.test.ts`
 * (TEST:V8a:8).
 */

import { PermissionEnum } from '@repo/schemas';
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

import {
    assertSupportCreateIsDraft,
    assertSupportEditContentOnly,
    buildSupportEditParts,
    isForeignContentEdit,
    LISTING_CONTENT_EDITED_BY_SUPPORT_TEMPLATE,
    type RecordListingSupportEditInput,
    recordListingSupportEdit
} from '../../../src/services/listing/listing-support-edit';
import type { Actor, ServiceContext } from '../../../src/types';
import {
    _resetActionReasonResolver,
    setActionReasonResolver
} from '../../../src/utils/action-reason';
import { runWithAdministrativeAuthorization } from '../../../src/utils/administrative-authorization';
import { domainEventModelDouble } from '../../helpers/owner-act-doubles';

const OWNER_ID = '00000000-0000-4000-a000-000000000001';
const ADMIN_ID = '00000000-0000-4000-a000-000000000002';
const LISTING_ID = '00000000-0000-4000-a000-000000000003';
const CORRELATION = '11111111-1111-4111-8111-111111111111';

const actor = (id: string, permissions: readonly PermissionEnum[] = []): Actor => ({
    id,
    roles: [],
    permissions: [...permissions]
});
const admin15 = actor(ADMIN_ID, [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT]);

/** Runs `run` inside an action-15 scope a route would open for `subjectId`. */
const inScope = <T>(subjectId: string, run: () => Promise<T>): Promise<T> =>
    runWithAdministrativeAuthorization({ authorization: { action: 'ACC_15', subjectId }, run });

/** The register, called inside an action-15 scope bound to the owner. */
const scoped = (input: RecordListingSupportEditInput) =>
    inScope(OWNER_ID, () => recordListingSupportEdit(input));

/** A fake tx answering the owner-email read with the given rows. */
const fakeTx = (rows: readonly { email: string | null }[]): ServiceContext['tx'] => {
    const chain = {
        select: () => chain,
        from: () => chain,
        where: () => chain,
        limit: async () => rows
    };
    return chain as unknown as ServiceContext['tx'];
};

beforeEach(() => {
    domainEventModelDouble.writes.length = 0;
    outbox.calls.length = 0;
});

afterEach(() => {
    _resetActionReasonResolver();
});

describe('buildSupportEditParts', () => {
    it('maps field names to parts without duplicates, in a stable order', () => {
        const { parts } = buildSupportEditParts({
            changes: [
                { field: 'faqs' },
                { field: 'media' },
                { field: 'description' },
                { field: 'name' },
                { field: 'schedule' },
                { field: 'featuredImage' }
            ]
        });

        expect(parts).toEqual(['texts', 'photos', 'faq', 'hours']);
    });

    it('classifies an unknown field as other and ignores non-content fields', () => {
        const { parts } = buildSupportEditParts({
            changes: [
                { field: 'priceRange' },
                { field: 'lifecycleState', old: 'ACTIVE', new: 'INACTIVE' },
                { field: 'publicationStatus', new: 'DRAFT' }
            ]
        });

        expect(parts).toEqual(['other']);
    });

    it('returns no parts when only non-content fields changed', () => {
        expect(
            buildSupportEditParts({ changes: [{ field: 'visibility', old: 'A', new: 'B' }] }).parts
        ).toEqual([]);
    });
});

describe('isForeignContentEdit', () => {
    it('is false for a holder of the permission outside an authorized scope', () => {
        expect(isForeignContentEdit({ actor: admin15, ownerId: OWNER_ID })).toBe(false);
    });

    it('is true for a holder of the permission inside a scope bound to the owner', async () => {
        expect(
            await inScope(OWNER_ID, async () =>
                isForeignContentEdit({ actor: admin15, ownerId: OWNER_ID })
            )
        ).toBe(true);
    });

    it('is false for the owner, a foreign actor without the permission, or an unknown owner, even in scope', async () => {
        const owner = actor(OWNER_ID, [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT]);
        const other = actor(ADMIN_ID, [PermissionEnum.ACCOMMODATION_UPDATE_ANY]);
        const results = await inScope(OWNER_ID, async () => [
            isForeignContentEdit({ actor: owner, ownerId: OWNER_ID }),
            isForeignContentEdit({ actor: other, ownerId: OWNER_ID }),
            isForeignContentEdit({ actor: admin15, ownerId: null })
        ]);
        expect(results).toEqual([false, false, false]);
    });
});

describe('assertSupportEditContentOnly', () => {
    it('accepts content fields inside an action-15 scope', async () => {
        const result = await inScope(OWNER_ID, async () =>
            assertSupportEditContentOnly({
                data: { description: 'x', media: {}, faqs: [], openingHours: {}, seo: {} }
            })
        );
        expect(result).toEqual({ rejectedFields: [] });
    });

    it('rejects a non-content field inside an action-15 scope', async () => {
        await expect(
            inScope(OWNER_ID, async () =>
                assertSupportEditContentOnly({
                    data: { description: 'x', visibility: 'PUBLIC', ownerId: 'someone' }
                })
            )
        ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('refuses refreshSlugFromName and slug: the public URL is not content', async () => {
        for (const data of [{ name: 'Nuevo', refreshSlugFromName: true }, { slug: 'otro' }]) {
            await expect(
                inScope(OWNER_ID, async () => assertSupportEditContentOnly({ data }))
            ).rejects.toMatchObject({ code: 'FORBIDDEN' });
        }
    });

    it('refuses a nested moderation verdict inside content (a photo approved by support)', async () => {
        await expect(
            inScope(OWNER_ID, async () =>
                assertSupportEditContentOnly({
                    data: { media: { featuredImage: { url: 'u', moderationState: 'APPROVED' } } }
                })
            )
        ).rejects.toMatchObject({ code: 'FORBIDDEN' });
        expect(
            await inScope(OWNER_ID, async () =>
                assertSupportEditContentOnly({
                    data: { media: { gallery: [{ url: 'u', moderationState: 'PENDING' }] } }
                })
            )
        ).toEqual({ rejectedFields: [] });
    });

    it('is a no-op outside an action-15 scope', () => {
        expect(
            assertSupportEditContentOnly({
                data: { visibility: 'PUBLIC', lifecycleState: 'ACTIVE' }
            })
        ).toEqual({ rejectedFields: [] });
    });
});

describe('assertSupportCreateIsDraft', () => {
    it('accepts a draft, private, unfeatured, pending create inside an action-15 scope', async () => {
        const result = await inScope(OWNER_ID, async () =>
            assertSupportCreateIsDraft({
                data: {
                    name: 'x',
                    lifecycleState: 'DRAFT',
                    visibility: 'PRIVATE',
                    isFeatured: false,
                    moderationState: 'PENDING'
                }
            })
        );
        expect(result).toEqual({ rejectedFields: [] });
    });

    it('refuses a create born published, public, featured or approved inside an action-15 scope', async () => {
        for (const data of [
            { lifecycleState: 'ACTIVE' },
            { visibility: 'PUBLIC' },
            { isFeatured: true },
            { moderationState: 'APPROVED' },
            { media: { featuredImage: { moderationState: 'APPROVED' } } }
        ]) {
            await expect(
                inScope(OWNER_ID, async () => assertSupportCreateIsDraft({ data }))
            ).rejects.toMatchObject({ code: 'FORBIDDEN' });
        }
    });

    it('is a no-op outside an action-15 scope', () => {
        expect(assertSupportCreateIsDraft({ data: { lifecycleState: 'ACTIVE' } })).toEqual({
            rejectedFields: []
        });
    });
});

describe('recordListingSupportEdit', () => {
    it('writes an admin event with the reason and queues the owner email in the same tx', async () => {
        // Arrange
        const tx = fakeTx([{ email: 'duena@example.com' }]);

        // Act
        const result = await scoped({
            eventType: 'listing.edited',
            entityType: 'accommodation',
            listing: { id: LISTING_ID, ownerId: OWNER_ID, name: 'Cabaña' },
            actor: admin15,
            ctx: { tx, correlationId: CORRELATION, actionReason: ' pedido por teléfono ' },
            changes: [{ field: 'description' }]
        });

        // Assert
        expect(result).toEqual({ recorded: true });
        expect(domainEventModelDouble.writes).toEqual([
            {
                eventType: 'listing.edited',
                entityType: 'accommodation',
                entityId: LISTING_ID,
                actorId: ADMIN_ID,
                actorType: 'admin',
                reason: 'pedido por teléfono',
                correlationId: CORRELATION,
                changes: [{ field: 'description' }],
                tx
            }
        ]);
        expect(outbox.calls).toHaveLength(1);
        const call = outbox.calls[0];
        expect(call?.tx).toBe(tx);
        expect(call?.input).toMatchObject({
            recipientUserId: OWNER_ID,
            recipientEmail: 'duena@example.com',
            template: LISTING_CONTENT_EDITED_BY_SUPPORT_TEMPLATE,
            payload: {
                vertical: 'accommodation',
                listingId: LISTING_ID,
                listingName: 'Cabaña',
                parts: ['texts']
            }
        });
        expect(String(call?.input.dedupKey)).toContain(`event:${CORRELATION}`);
    });

    it('reads the reason from the wired resolver and records null without one', async () => {
        // Arrange
        setActionReasonResolver(() => 'ticket 42');
        const tx = fakeTx([{ email: 'duena@example.com' }]);
        const input = {
            eventType: 'listing.created' as const,
            entityType: 'gastronomy' as const,
            listing: { id: LISTING_ID, ownerId: OWNER_ID },
            actor: admin15,
            changes: [{ field: 'name' }]
        };

        // Act
        await scoped({ ...input, ctx: { tx } });
        _resetActionReasonResolver();
        await scoped({ ...input, ctx: { tx } });

        // Assert
        expect(domainEventModelDouble.writes.map((w) => w.reason)).toEqual(['ticket 42', null]);
        expect(outbox.calls[0]?.input.payload).toMatchObject({ listingName: null });
    });

    it('writes nothing for a foreign actor without the permission', async () => {
        const result = await scoped({
            eventType: 'listing.edited',
            entityType: 'experience',
            listing: { id: LISTING_ID, ownerId: OWNER_ID },
            actor: actor(ADMIN_ID, [PermissionEnum.EXPERIENCE_EDIT_ALL]),
            ctx: { tx: fakeTx([{ email: 'x@example.com' }]) },
            changes: [{ field: 'description' }]
        });

        expect(result).toEqual({ recorded: false });
        expect(domainEventModelDouble.writes).toEqual([]);
        expect(outbox.calls).toEqual([]);
    });

    it('writes nothing outside an action-15 scope, even for a holder of the permission', async () => {
        const result = await recordListingSupportEdit({
            eventType: 'listing.edited',
            entityType: 'accommodation',
            listing: { id: LISTING_ID, ownerId: OWNER_ID },
            actor: admin15,
            ctx: { tx: fakeTx([{ email: 'x@example.com' }]) },
            changes: [{ field: 'description' }]
        });

        expect(result).toEqual({ recorded: false });
        expect(domainEventModelDouble.writes).toEqual([]);
        expect(outbox.calls).toEqual([]);
    });

    it('throws without a transaction, writing nothing', async () => {
        await expect(
            scoped({
                eventType: 'listing.edited',
                entityType: 'accommodation',
                listing: { id: LISTING_ID, ownerId: OWNER_ID },
                actor: admin15,
                ctx: { correlationId: CORRELATION },
                changes: [{ field: 'description' }]
            })
        ).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
        expect(domainEventModelDouble.writes).toEqual([]);
        expect(outbox.calls).toEqual([]);
    });

    it('records the event but queues no email when the owner has no address', async () => {
        const result = await scoped({
            eventType: 'listing.edited',
            entityType: 'accommodation',
            listing: { id: LISTING_ID, ownerId: OWNER_ID },
            actor: admin15,
            ctx: { tx: fakeTx([]) },
            changes: [{ field: 'media' }]
        });

        expect(result).toEqual({ recorded: true });
        expect(domainEventModelDouble.writes).toHaveLength(1);
        expect(outbox.calls).toEqual([]);
    });
});
