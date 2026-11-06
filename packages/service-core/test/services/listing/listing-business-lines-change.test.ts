/**
 * Unit tests for the business-lines change register (ACC:27, HOS-1875): the
 * action-15 refusal, the classification-only rule, the action-27 gate, the
 * event and the owner email with translated labels. The DB write and the real
 * chain are covered by the integration suite of the route (part 2).
 */

import { trans } from '@repo/i18n';
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

vi.mock('../../../src/utils/transaction', async (importOriginal) => {
    const doubles = await import('../../helpers/owner-act-doubles');
    return {
        ...(await importOriginal<object>()),
        withServiceTransaction: doubles.fakeWithServiceTransaction
    };
});

import {
    assertBusinessLinesChangeOnly,
    isBusinessLinesChangeAuthorizedFor,
    LISTING_BUSINESS_LINES_CHANGED_TEMPLATE,
    type RecordListingBusinessLinesChangeInput,
    recordListingBusinessLinesChange
} from '../../../src/services/listing/listing-business-lines-change';
import { recordListingOwnerAct } from '../../../src/services/listing/listing-owner-act';
import {
    assertSupportEditContentOnly,
    LISTING_CONTENT_EDITED_BY_SUPPORT_TEMPLATE
} from '../../../src/services/listing/listing-support-edit';
import { VenueService } from '../../../src/services/venue/venue.service';
import type { Actor, ServiceContext } from '../../../src/types';
import { _resetActionReasonResolver } from '../../../src/utils/action-reason';
import {
    isAction15AuthorizedFor,
    runWithAdministrativeAuthorization
} from '../../../src/utils/administrative-authorization';
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
const admin27 = actor(ADMIN_ID, [PermissionEnum.VENUE_EDIT_ALL]);

/** Runs `run` inside the administrative scope a route would open for `subjectId`. */
const inScope = <T>(
    action: 'ACC_15' | 'ACC_27',
    subjectId: string,
    run: () => Promise<T>
): Promise<T> => runWithAdministrativeAuthorization({ authorization: { action, subjectId }, run });

type OwnerRow = {
    readonly email: string | null;
    readonly settings?: { readonly languageWeb?: string } | null;
};

/** A fake tx answering the owner read with the given rows. */
const fakeTx = (rows: readonly OwnerRow[]): ServiceContext['tx'] => {
    const chain = {
        select: () => chain,
        from: () => chain,
        where: () => chain,
        limit: async () => rows
    };
    return chain as unknown as ServiceContext['tx'];
};

const recordInScope = (input: RecordListingBusinessLinesChangeInput) =>
    inScope('ACC_27', OWNER_ID, () => recordListingBusinessLinesChange(input));

beforeEach(() => {
    domainEventModelDouble.writes.length = 0;
    outbox.calls.length = 0;
});

afterEach(() => {
    _resetActionReasonResolver();
});

describe('TEST:7.3:3 AC:7:8 action 15 never edits business lines', () => {
    it('refuses businessLines inside an action-15 scope even with venue.editAll', async () => {
        const mixed = actor(ADMIN_ID, [
            PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT,
            PermissionEnum.VENUE_EDIT_ALL
        ]);
        // The actor's permissions do not matter to the scope rule: the action is
        // what the route authorized, and action 15 writes content only.
        expect(mixed.permissions).toContain(PermissionEnum.VENUE_EDIT_ALL);
        await expect(
            inScope('ACC_15', OWNER_ID, async () =>
                assertSupportEditContentOnly({ data: { businessLines: ['food'] } })
            )
        ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
});

describe('TEST:7.3:3 assertBusinessLinesChangeOnly', () => {
    it('accepts businessLines inside an action-27 scope', async () => {
        expect(
            await inScope('ACC_27', OWNER_ID, async () =>
                assertBusinessLinesChangeOnly({ data: { businessLines: ['food'] } })
            )
        ).toEqual({ rejectedFields: [] });
    });

    it('rejects any other defined field naming it, inside an action-27 scope', async () => {
        await expect(
            inScope('ACC_27', OWNER_ID, async () =>
                assertBusinessLinesChangeOnly({
                    data: { businessLines: ['food'], description: 'x' }
                })
            )
        ).rejects.toMatchObject({
            code: 'FORBIDDEN',
            message: expect.stringContaining('description')
        });
    });

    it('is a no-op outside an action-27 scope', () => {
        expect(
            assertBusinessLinesChangeOnly({ data: { businessLines: ['food'], description: 'x' } })
        ).toEqual({ rejectedFields: [] });
    });
});

describe('TEST:7.3:3 isBusinessLinesChangeAuthorizedFor', () => {
    it('is true only for an ACC_27 scope on the owner with venue.editAll and a foreign actor', async () => {
        const checks = await inScope('ACC_27', OWNER_ID, async () => [
            isBusinessLinesChangeAuthorizedFor({
                actor: admin27,
                ownerId: OWNER_ID,
                vertical: 'venue'
            }),
            isBusinessLinesChangeAuthorizedFor({
                actor: admin27,
                ownerId: OWNER_ID,
                vertical: 'venue'
            })
        ]);
        expect(checks).toEqual([true, true]);
    });

    it('is false for an ACC_15 scope, another subject, no editAll, or the owner', async () => {
        const checks = await inScope('ACC_27', OWNER_ID, async () => [
            isBusinessLinesChangeAuthorizedFor({
                actor: admin27,
                ownerId: OWNER_ID,
                vertical: 'venue'
            })
        ]);
        expect(checks).toEqual([true]);

        expect(
            await inScope('ACC_15', OWNER_ID, async () =>
                isBusinessLinesChangeAuthorizedFor({
                    actor: admin27,
                    ownerId: OWNER_ID,
                    vertical: 'venue'
                })
            )
        ).toBe(false);
        expect(
            await inScope('ACC_27', 'other-owner', async () =>
                isBusinessLinesChangeAuthorizedFor({
                    actor: admin27,
                    ownerId: OWNER_ID,
                    vertical: 'venue'
                })
            )
        ).toBe(false);
        expect(
            await inScope('ACC_27', OWNER_ID, async () =>
                isBusinessLinesChangeAuthorizedFor({
                    actor: actor(ADMIN_ID, [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT]),
                    ownerId: OWNER_ID,
                    vertical: 'venue'
                })
            )
        ).toBe(false);
        expect(
            await inScope('ACC_27', OWNER_ID, async () =>
                isBusinessLinesChangeAuthorizedFor({
                    actor: actor(OWNER_ID, [PermissionEnum.VENUE_EDIT_ALL]),
                    ownerId: OWNER_ID,
                    vertical: 'venue'
                })
            )
        ).toBe(false);
    });

    it('keeps isAction15AuthorizedFor false inside an ACC_27 scope', async () => {
        expect(
            await inScope('ACC_27', OWNER_ID, async () =>
                isAction15AuthorizedFor({ actor: admin27, ownerId: OWNER_ID })
            )
        ).toBe(false);
    });
});

describe('TEST:7.3:3 recordListingOwnerAct under ACC_27', () => {
    const changes = [{ field: 'businessLines', old: ['food'], new: ['food', 'nightlife'] }];
    const input = {
        eventType: 'listing.edited' as const,
        entityType: 'venue' as const,
        listing: { id: LISTING_ID, ownerId: OWNER_ID, name: 'Parrilla' },
        actor: admin27,
        changes
    };

    it('writes one admin event and one translated email in the same tx', async () => {
        const tx = fakeTx([{ email: 'duena@example.com', settings: { languageWeb: 'es' } }]);

        const result = await inScope('ACC_27', OWNER_ID, () =>
            recordListingOwnerAct({ ...input, ctx: { tx, correlationId: CORRELATION } })
        );

        expect(result).toEqual({ recorded: true });
        expect(domainEventModelDouble.writes).toEqual([
            {
                eventType: 'listing.edited',
                entityType: 'venue',
                entityId: LISTING_ID,
                actorId: ADMIN_ID,
                actorType: 'admin',
                reason: null,
                correlationId: CORRELATION,
                changes,
                tx
            }
        ]);
        expect(outbox.calls).toHaveLength(1);
        const call = outbox.calls[0];
        expect(call?.tx).toBe(tx);
        expect(call?.input).toMatchObject({
            recipientUserId: OWNER_ID,
            recipientEmail: 'duena@example.com',
            template: LISTING_BUSINESS_LINES_CHANGED_TEMPLATE,
            payload: {
                vertical: 'venue',
                listingId: LISTING_ID,
                listingName: 'Parrilla',
                addedLines: [trans.es['venue.owner.businessLines.nightlife.label']],
                removedLines: [],
                shownSections: [trans.es['listing.owner.editor.sectionNav.nightInfo']],
                hiddenSections: []
            }
        });
        expect(String(call?.input.dedupKey)).toContain(`event:${CORRELATION}`);
        expect(call?.input.template).not.toBe(LISTING_CONTENT_EDITED_BY_SUPPORT_TEMPLATE);
        expect(
            outbox.calls.filter(
                (entry) => entry.input.template === LISTING_CONTENT_EDITED_BY_SUPPORT_TEMPLATE
            )
        ).toEqual([]);
    });

    it('uses the owner web locale for the labels and falls back to es', async () => {
        await inScope('ACC_27', OWNER_ID, () =>
            recordListingOwnerAct({
                ...input,
                ctx: { tx: fakeTx([{ email: 'en@example.com', settings: { languageWeb: 'en' } }]) }
            })
        );
        expect(outbox.calls[0]?.input.payload).toMatchObject({
            addedLines: [trans.en['venue.owner.businessLines.nightlife.label']],
            shownSections: [trans.en['listing.owner.editor.sectionNav.nightInfo']]
        });

        outbox.calls.length = 0;
        await inScope('ACC_27', OWNER_ID, () =>
            recordListingOwnerAct({
                ...input,
                ctx: { tx: fakeTx([{ email: 'xx@example.com', settings: { languageWeb: 'xx' } }]) }
            })
        );
        expect(outbox.calls[0]?.input.payload).toMatchObject({
            addedLines: [trans.es['venue.owner.businessLines.nightlife.label']]
        });

        outbox.calls.length = 0;
        await inScope('ACC_27', OWNER_ID, () =>
            recordListingOwnerAct({
                ...input,
                ctx: { tx: fakeTx([{ email: 'none@example.com' }]) }
            })
        );
        expect(outbox.calls[0]?.input.payload).toMatchObject({
            addedLines: [trans.es['venue.owner.businessLines.nightlife.label']]
        });
    });

    it('records nothing without venue.editAll inside the ACC_27 scope', async () => {
        const result = await recordInScope({
            ...input,
            actor: actor(ADMIN_ID, [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT]),
            ctx: { tx: fakeTx([{ email: 'duena@example.com' }]) }
        });

        expect(result).toEqual({ recorded: false });
        expect(domainEventModelDouble.writes).toEqual([]);
        expect(outbox.calls).toEqual([]);
    });
});

describe('TEST:7.3:3 VenueService.update under ACC_27', () => {
    it('refuses a payload that mixes business lines with other fields, writing nothing', async () => {
        const model = {
            entityName: 'listing',
            findById: vi.fn(async () => ({ id: LISTING_ID, ownerId: OWNER_ID })),
            update: vi.fn(async () => ({ id: LISTING_ID }))
        };
        const logger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
            log: vi.fn()
        };
        const service = Object.assign(new VenueService({ logger } as never), { model });

        const result = await inScope('ACC_27', OWNER_ID, () =>
            service.update(admin27, LISTING_ID, {
                businessLines: ['food'],
                description: 'Una descripción suficientemente larga para la validación.'
            })
        );

        expect(result.error?.code).toBe('FORBIDDEN');
        expect(model.update).not.toHaveBeenCalled();
    });
});
