import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { DirectEmailTemplateService } from '../../../src/services/direct-email/direct-email-template.service.js';
import type { Actor } from '../../../src/types/index.js';

const ID = '22222222-2222-4222-8222-222222222222';
const BODY = {
    type: 'doc' as const,
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hola' }] }]
};

const buildActor = (permissions: PermissionEnum[]): Actor => ({
    id: '11111111-1111-4111-8111-111111111111',
    roles: [RoleEnum.ADMIN],
    permissions
});

const WRITER = buildActor([
    PermissionEnum.DIRECT_EMAIL_VIEW,
    PermissionEnum.DIRECT_EMAIL_TEMPLATE_WRITE
]);

const buildService = () => {
    const model = {
        findLivePage: vi.fn(async () => ({ items: [], total: 0 })),
        findLiveById: vi.fn(async () => ({ id: ID, name: 'T' })),
        create: vi.fn(async (data: Record<string, unknown>) => ({ id: ID, ...data })),
        update: vi.fn(async (_where: unknown, data: Record<string, unknown>) => ({
            id: ID,
            ...data
        })),
        softDelete: vi.fn(async () => 1)
    };
    return { service: new DirectEmailTemplateService({}, { model: model as never }), model };
};

describe('DirectEmailTemplateService', () => {
    it('creates a template recording the creator', async () => {
        // Arrange
        const { service, model } = buildService();

        // Act
        const result = await service.create(WRITER, {
            name: 'Alianza',
            subject: 'Hola',
            bodyJson: BODY
        });

        // Assert
        expect(result.error).toBeUndefined();
        expect(model.create).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Alianza', createdBy: WRITER.id }),
            undefined
        );
    });

    it('rejects an invalid create body', async () => {
        const { service, model } = buildService();
        const result = await service.create(WRITER, { name: '', subject: 'Hola', bodyJson: BODY });
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(model.create).not.toHaveBeenCalled();
    });

    it('writes require DIRECT_EMAIL_TEMPLATE_WRITE', async () => {
        const { service, model } = buildService();
        const viewer = buildActor([
            PermissionEnum.DIRECT_EMAIL_VIEW,
            PermissionEnum.DIRECT_EMAIL_SEND
        ]);
        const create = await service.create(viewer, { name: 'A', subject: 'B', bodyJson: BODY });
        const update = await service.update(viewer, { id: ID, data: { name: 'X' } });
        const remove = await service.softDelete(viewer, { id: ID });
        for (const result of [create, update, remove]) {
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        }
        expect(model.create).not.toHaveBeenCalled();
        expect(model.update).not.toHaveBeenCalled();
        expect(model.softDelete).not.toHaveBeenCalled();
    });

    it('reads require DIRECT_EMAIL_VIEW', async () => {
        const { service } = buildService();
        const nobody = buildActor([]);
        expect((await service.list(nobody, {})).error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect((await service.getById(nobody, { id: ID })).error?.code).toBe(
            ServiceErrorCode.FORBIDDEN
        );
    });

    it('updates a live template recording the editor', async () => {
        const { service, model } = buildService();
        const result = await service.update(WRITER, { id: ID, data: { subject: 'Nuevo' } });
        expect(result.error).toBeUndefined();
        expect(model.update).toHaveBeenCalledWith(
            { id: ID },
            { subject: 'Nuevo', updatedBy: WRITER.id },
            undefined
        );
    });

    it('answers NOT_FOUND when updating or deleting a missing or deleted template', async () => {
        const { service, model } = buildService();
        model.findLiveById.mockResolvedValue(null as never);
        const update = await service.update(WRITER, { id: ID, data: { name: 'X' } });
        const remove = await service.softDelete(WRITER, { id: ID });
        expect(update.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(remove.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.softDelete).not.toHaveBeenCalled();
    });

    it('soft-deletes passing the actor id', async () => {
        const { service, model } = buildService();
        const result = await service.softDelete(WRITER, { id: ID });
        expect(result.data).toEqual({ id: ID });
        expect(model.softDelete).toHaveBeenCalledWith({ id: ID }, WRITER.id, undefined);
    });
});
