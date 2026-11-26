/**
 * Venue `entryNote` as a translation source (HOS-2658, AC-25).
 *
 * The update writes only `es` from the body through the model's atomic
 * expression, which keeps the `en` / `pt` of the row the UPDATE locks; the
 * on-save run then sees `entryNote` as a changed source.
 *
 * @module test/services/venue/venue-entry-note-source
 */

import { PermissionEnum, PublicationStatusEnum, RoleEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

vi.mock('../../../src/services/listing/listing-revalidation.js', () => ({
    scheduleListingRevalidation: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('../../../src/utils/transaction', async () => {
    const doubles = await import('../../helpers/owner-act-doubles');
    return { withServiceTransaction: vi.fn(doubles.fakeWithServiceTransaction) };
});
vi.mock('@repo/db', async (importOriginal) => {
    const doubles = await import('../../helpers/owner-act-doubles');
    return {
        ...(await importOriginal<object>()),
        domainEventModel: doubles.domainEventModelDouble
    };
});

import type { QrCodeService } from '../../../src/services/qr-code/qr-code.service';
import { resolveVenueEntryNoteSource } from '../../../src/services/venue/venue.entry-note-source';
import { VenueService } from '../../../src/services/venue/venue.service';
import {
    _resetTranslationService,
    initializeTranslationService
} from '../../../src/translation/translation-init';
import type { Actor } from '../../../src/types';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';

const VENUE_ID = getMockId('user', 'venue-en-1');
const OWNER_ID = getMockId('user', 'owner-venue-en-1');

const STORED_NOTE = { es: 'Gratis hasta las 0', en: 'Free until midnight (manual)', pt: 'Grátis' };

const makeVenue = (overrides: Record<string, unknown> = {}) => ({
    id: VENUE_ID,
    name: 'Bar del Puerto',
    slug: 'bar-del-puerto',
    type: 'BAR',
    destinationId: getMockId('destination', 'dest-venue-en-1'),
    ownerId: OWNER_ID,
    publicationStatus: PublicationStatusEnum.DRAFT,
    entryNoteI18n: STORED_NOTE,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
    ...overrides
});

type AnyService = any;

/** Marker the fake model's builder returns in place of the SQL expression. */
type SourceMarker = { readonly __entryNoteSource: string };

const isSourceMarker = (value: unknown): value is SourceMarker =>
    typeof value === 'object' && value !== null && '__entryNoteSource' in value;

function buildService(input: { existing: Record<string, unknown> }): {
    service: AnyService;
    update: Mock;
    buildEntryNoteSourceUpdate: Mock;
} {
    const buildEntryNoteSourceUpdate = vi.fn(({ es }: { es: string }) => ({
        entryNoteI18n: { __entryNoteSource: es }
    }));
    // Resolves the marker the way the SQL expression does: en/pt from the row
    // as it is at UPDATE time (`input.existing`), never from the hook snapshot.
    const update = vi.fn(async (_where: unknown, patch: Record<string, unknown>) => {
        const stored = (input.existing.entryNoteI18n ?? null) as Record<string, string> | null;
        const note = patch.entryNoteI18n;
        return {
            ...input.existing,
            ...patch,
            ...(isSourceMarker(note)
                ? {
                      entryNoteI18n: {
                          es: note.__entryNoteSource,
                          en: stored?.en ?? '',
                          pt: stored?.pt ?? ''
                      }
                  }
                : {})
        };
    });
    const model = {
        entityName: 'venue',
        findById: vi.fn().mockResolvedValue(input.existing),
        findOne: vi.fn().mockResolvedValue(null),
        update,
        updateById: update,
        buildEntryNoteSourceUpdate
    };
    const qr = {
        findLiveCodeForEntity: vi.fn().mockResolvedValue({ data: null, error: undefined }),
        setEntityTargetUrl: vi.fn()
    } as unknown as QrCodeService;
    const service: AnyService = new VenueService({ logger: createLoggerMock() }, undefined, qr);
    service.model = model;
    service._destinationModel = { findById: vi.fn().mockResolvedValue({ slug: 'destino-test' }) };
    return { service, update, buildEntryNoteSourceUpdate };
}

const admin: Actor = {
    id: 'admin-uuid-en',
    roles: [RoleEnum.ADMIN],
    permissions: [PermissionEnum.VENUE_EDIT_ALL]
};

describe('resolveVenueEntryNoteSource', () => {
    it('takes only es from the body and ignores its en/pt', () => {
        // Arrange / Act
        const result = resolveVenueEntryNoteSource({
            body: { es: 'Gratis hasta la 1', en: 'stale', pt: 'stale' }
        });

        // Assert
        expect(result).toEqual({ es: 'Gratis hasta la 1' });
    });

    it('writes an empty source when es is not a string', () => {
        // Arrange / Act / Assert
        expect(resolveVenueEntryNoteSource({ body: { en: 'x' } })).toEqual({ es: '' });
    });

    it('leaves null and absent bodies untouched', () => {
        // Arrange / Act / Assert
        expect(resolveVenueEntryNoteSource({ body: null })).toEqual({});
        expect(resolveVenueEntryNoteSource({ body: undefined })).toEqual({});
    });
});

describe('VenueService — entryNote source on update (HOS-2658, AC-25)', () => {
    let translateMock: Mock;

    beforeEach(() => {
        vi.clearAllMocks();
        translateMock = vi.fn().mockResolvedValue(undefined);
        initializeTranslationService({ translate: translateMock });
    });

    afterEach(() => {
        _resetTranslationService();
    });

    it('persists es from the body, keeps the stored en/pt and translates entryNote', async () => {
        // Arrange
        const { service, update, buildEntryNoteSourceUpdate } = buildService({
            existing: makeVenue()
        });

        // Act
        const result = await service.update(admin, VENUE_ID, {
            entryNoteI18n: { es: 'Gratis hasta la 1', en: 'stale', pt: 'stale' }
        });

        // Assert
        expect(result.error).toBeUndefined();
        expect(buildEntryNoteSourceUpdate.mock.calls).toEqual([[{ es: 'Gratis hasta la 1' }]]);
        const written = update.mock.calls[0]?.[1] as Record<string, unknown>;
        expect(written.entryNoteI18n).toEqual({ __entryNoteSource: 'Gratis hasta la 1' });
        expect(translateMock).toHaveBeenCalledWith({
            entityType: 'venue',
            entityId: VENUE_ID,
            fields: { entryNote: 'Gratis hasta la 1' },
            billing: { vertical: 'venue', ownerId: OWNER_ID }
        });
    });

    it('keeps a null entryNoteI18n null', async () => {
        // Arrange
        const { service, update, buildEntryNoteSourceUpdate } = buildService({
            existing: makeVenue()
        });

        // Act
        await service.update(admin, VENUE_ID, { entryNoteI18n: null });

        // Assert
        expect(buildEntryNoteSourceUpdate).not.toHaveBeenCalled();
        const written = update.mock.calls[0]?.[1] as Record<string, unknown>;
        expect(written.entryNoteI18n).toBeNull();
    });
});
