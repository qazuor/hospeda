/**
 * HOS-2679 — the QR-code tag catalog and the per-code tag set.
 *
 * Covers: slug derivation and the live-duplicate refusal (create and rename),
 * the "only symbols" name, the permission matrix reusing the QR verbs, and the
 * set-tags write (404 for a missing code, 400 for an unknown tag, de-dup,
 * idempotent replace).
 */
import type { QrCodeModel, QrCodeTagModel, RQrCodeQrCodeTagModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode, TagColorEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import {
    deriveQrCodeTagSlug,
    QrCodeTagService
} from '../../../src/services/qr-code/qr-code-tag.service';
import { createActor } from '../../factories/actorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const TAG_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_TAG_ID = '22222222-2222-4222-8222-222222222222';
const QR_ID = '33333333-3333-4333-8333-333333333333';

const tagRow = {
    id: TAG_ID,
    name: 'Verano 2026',
    slug: 'verano-2026',
    color: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    createdById: null,
    updatedById: null,
    deletedAt: null,
    deletedById: null
};

const QR_VERBS = [
    PermissionEnum.QR_CODE_VIEW,
    PermissionEnum.QR_CODE_CREATE,
    PermissionEnum.QR_CODE_UPDATE,
    PermissionEnum.QR_CODE_DELETE
];

/** A model mock whose extra methods are typed as mocks too. */
type MockedModel = Record<
    | 'findById'
    | 'findOne'
    | 'create'
    | 'update'
    | 'softDelete'
    | 'findLiveBySlug'
    | 'countLiveByIds'
    | 'setTagsForQrCode'
    | 'findTagRefsByQrCodeIds',
    Mock
>;

describe('deriveQrCodeTagSlug', () => {
    it('folds case, accents and spacing into one slug', () => {
        expect(deriveQrCodeTagSlug({ name: 'Verano 2026' })).toBe('verano-2026');
        expect(deriveQrCodeTagSlug({ name: 'verano   2026' })).toBe('verano-2026');
        expect(deriveQrCodeTagSlug({ name: 'Folletería' })).toBe('folleteria');
    });

    it('answers empty for a name with nothing to slug', () => {
        expect(deriveQrCodeTagSlug({ name: '!!!' })).toBe('');
    });
});

describe('QrCodeTagService', () => {
    let service: QrCodeTagService;
    let tagModel: MockedModel;
    let qrModel: MockedModel;
    let linkModel: MockedModel;
    const operator = createActor({ permissions: QR_VERBS });
    const readOnly = createActor({ permissions: [PermissionEnum.QR_CODE_VIEW] });

    beforeEach(() => {
        vi.clearAllMocks();
        tagModel = createModelMock(['findLiveBySlug', 'countLiveByIds']) as unknown as MockedModel;
        qrModel = createModelMock() as unknown as MockedModel;
        linkModel = createModelMock([
            'setTagsForQrCode',
            'findTagRefsByQrCodeIds'
        ]) as unknown as MockedModel;
        service = new QrCodeTagService(
            { logger: createLoggerMock() },
            tagModel as unknown as QrCodeTagModel,
            qrModel as unknown as QrCodeModel,
            linkModel as unknown as RQrCodeQrCodeTagModel
        );
    });

    describe('create', () => {
        it('derives the slug from the name and writes only name, colour and slug', async () => {
            // Arrange
            tagModel.findLiveBySlug.mockResolvedValue(null);
            tagModel.create.mockResolvedValue(tagRow);

            // Act
            const result = await service.create(operator, {
                name: '  Verano 2026 ',
                color: TagColorEnum.BLUE
            });

            // Assert
            expect(result.error).toBeUndefined();
            expect(tagModel.findLiveBySlug).toHaveBeenCalledWith('verano-2026', undefined);
            const written = tagModel.create.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(written.name).toBe('Verano 2026');
            expect(written.slug).toBe('verano-2026');
            expect(written.color).toBe('BLUE');
        });

        it('stores a missing colour as null', async () => {
            tagModel.findLiveBySlug.mockResolvedValue(null);
            tagModel.create.mockResolvedValue(tagRow);

            await service.create(operator, { name: 'Costanera' });

            const written = tagModel.create.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(written.color).toBeNull();
        });

        it('refuses a name that slugs onto a live tag (409)', async () => {
            tagModel.findLiveBySlug.mockResolvedValue(tagRow);

            const result = await service.create(operator, { name: 'verano  2026' });

            expect(result.error?.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
            expect(tagModel.create).not.toHaveBeenCalled();
        });

        it('refuses a name with nothing to slug (400)', async () => {
            const result = await service.create(operator, { name: '???' });

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(tagModel.findLiveBySlug).not.toHaveBeenCalled();
            expect(tagModel.create).not.toHaveBeenCalled();
        });

        it('refuses a read-only QR operator', async () => {
            const result = await service.create(readOnly, { name: 'Costanera' });

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(tagModel.create).not.toHaveBeenCalled();
        });
    });

    describe('update', () => {
        beforeEach(() => {
            tagModel.findById.mockResolvedValue(tagRow);
            tagModel.findOne.mockResolvedValue(tagRow);
            tagModel.update.mockImplementation(async (_w: unknown, data: object) => ({
                ...tagRow,
                ...data
            }));
        });

        it('re-derives the slug on rename', async () => {
            tagModel.findLiveBySlug.mockResolvedValue(null);

            const result = await service.update(operator, TAG_ID, { name: 'Invierno' });

            expect(result.error).toBeUndefined();
            const patch = tagModel.update.mock.calls[0]?.[1] as Record<string, unknown>;
            expect(patch.name).toBe('Invierno');
            expect(patch.slug).toBe('invierno');
        });

        it('lets a tag keep its own slug (a case-only rename)', async () => {
            tagModel.findLiveBySlug.mockResolvedValue(tagRow);

            const result = await service.update(operator, TAG_ID, { name: 'VERANO 2026' });

            expect(result.error).toBeUndefined();
        });

        it('refuses a rename onto ANOTHER live tag (409)', async () => {
            tagModel.findLiveBySlug.mockResolvedValue({ ...tagRow, id: OTHER_TAG_ID });

            const result = await service.update(operator, TAG_ID, { name: 'Verano 2026' });

            expect(result.error?.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
            expect(tagModel.update).not.toHaveBeenCalled();
        });

        it('does not touch the slug on a colour-only edit', async () => {
            const result = await service.update(operator, TAG_ID, { color: TagColorEnum.RED });

            expect(result.error).toBeUndefined();
            expect(tagModel.findLiveBySlug).not.toHaveBeenCalled();
            const patch = tagModel.update.mock.calls[0]?.[1] as Record<string, unknown>;
            expect(patch.slug).toBeUndefined();
            expect(patch.color).toBe('RED');
        });

        it('refuses a read-only QR operator', async () => {
            const result = await service.update(readOnly, TAG_ID, { name: 'X' });
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('softDelete', () => {
        it('needs QR_CODE_DELETE', async () => {
            tagModel.findById.mockResolvedValue(tagRow);
            tagModel.findOne.mockResolvedValue(tagRow);
            const updater = createActor({
                permissions: [PermissionEnum.QR_CODE_VIEW, PermissionEnum.QR_CODE_UPDATE]
            });

            const result = await service.softDelete(updater, TAG_ID);

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(tagModel.softDelete).not.toHaveBeenCalled();
        });
    });

    describe('setTagsForCode', () => {
        const liveCode = { id: QR_ID, deletedAt: null };
        const refs = [{ id: TAG_ID, name: 'Verano 2026', slug: 'verano-2026', color: null }];

        it('replaces the set with the de-duplicated ids and answers the new tags', async () => {
            // Arrange
            qrModel.findById.mockResolvedValue(liveCode);
            tagModel.countLiveByIds.mockResolvedValue(1);
            linkModel.findTagRefsByQrCodeIds.mockResolvedValue(new Map([[QR_ID, refs]]));

            // Act
            const result = await service.setTagsForCode({
                actor: operator,
                qrCodeId: QR_ID,
                tagIds: [TAG_ID, TAG_ID]
            });

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data).toStrictEqual({ items: refs });
            expect(tagModel.countLiveByIds).toHaveBeenCalledWith([TAG_ID], undefined);
            expect(linkModel.setTagsForQrCode).toHaveBeenCalledWith(QR_ID, [TAG_ID], undefined);
        });

        it('clears the set with an empty list', async () => {
            qrModel.findById.mockResolvedValue(liveCode);
            tagModel.countLiveByIds.mockResolvedValue(0);
            linkModel.findTagRefsByQrCodeIds.mockResolvedValue(new Map());

            const result = await service.setTagsForCode({
                actor: operator,
                qrCodeId: QR_ID,
                tagIds: []
            });

            expect(result.data).toStrictEqual({ items: [] });
            expect(linkModel.setTagsForQrCode).toHaveBeenCalledWith(QR_ID, [], undefined);
        });

        it('refuses an unknown or deleted tag without writing (400 UNKNOWN_TAG)', async () => {
            qrModel.findById.mockResolvedValue(liveCode);
            tagModel.countLiveByIds.mockResolvedValue(1);

            const result = await service.setTagsForCode({
                actor: operator,
                qrCodeId: QR_ID,
                tagIds: [TAG_ID, OTHER_TAG_ID]
            });

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.details).toMatchObject({ reason: 'UNKNOWN_TAG' });
            expect(linkModel.setTagsForQrCode).not.toHaveBeenCalled();
        });

        it('answers 404 for a missing code', async () => {
            qrModel.findById.mockResolvedValue(null);

            const result = await service.setTagsForCode({
                actor: operator,
                qrCodeId: QR_ID,
                tagIds: [TAG_ID]
            });

            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
            expect(linkModel.setTagsForQrCode).not.toHaveBeenCalled();
        });

        it('answers 404 for a soft-deleted code', async () => {
            qrModel.findById.mockResolvedValue({ ...liveCode, deletedAt: new Date() });

            const result = await service.setTagsForCode({
                actor: operator,
                qrCodeId: QR_ID,
                tagIds: []
            });

            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });

        it('refuses a read-only QR operator', async () => {
            const result = await service.setTagsForCode({
                actor: readOnly,
                qrCodeId: QR_ID,
                tagIds: []
            });

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(qrModel.findById).not.toHaveBeenCalled();
        });
    });

    describe('getTagsForCode', () => {
        it('lets a read-only operator read the tags', async () => {
            qrModel.findById.mockResolvedValue({ id: QR_ID, deletedAt: null });
            linkModel.findTagRefsByQrCodeIds.mockResolvedValue(new Map());

            const result = await service.getTagsForCode({ actor: readOnly, qrCodeId: QR_ID });

            expect(result.data).toStrictEqual({ items: [] });
            expect(linkModel.findTagRefsByQrCodeIds).toHaveBeenCalledWith([QR_ID], undefined);
        });

        it('refuses an actor with no QR verb', async () => {
            const result = await service.getTagsForCode({
                actor: createActor({ permissions: [] }),
                qrCodeId: QR_ID
            });
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });
});
