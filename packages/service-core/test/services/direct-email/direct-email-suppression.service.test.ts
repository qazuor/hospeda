import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { DirectEmailSuppressionService } from '../../../src/services/direct-email/direct-email-suppression.service.js';
import type { Actor } from '../../../src/types/index.js';

const buildActor = (permissions: PermissionEnum[]): Actor => ({
    id: '11111111-1111-4111-8111-111111111111',
    roles: [RoleEnum.ADMIN],
    permissions
});

const TOKEN = 'k3j2h4g5f6d7s8a9p0o1i2u3y4t5r6e7w8q9z0x1c2v';

const buildService = (recipients: Record<string, string> = { [TOKEN]: 'Juan@Example.com' }) => {
    const model = {
        findPage: vi.fn(async () => ({ items: [], total: 0 })),
        insertIfAbsent: vi.fn(async () => ({ suppression: { id: 's' }, created: true })),
        findOne: vi.fn(async (): Promise<Record<string, unknown> | null> => null),
        hardDelete: vi.fn(async () => 1),
        findSuppressedEmails: vi.fn()
    };
    const recipientModel = {
        findByOptOutToken: vi.fn(async (token: string) =>
            recipients[token] ? { email: recipients[token], optOutToken: token } : null
        )
    };
    const service = new DirectEmailSuppressionService(
        {},
        { model: model as never, recipientModel: recipientModel as never }
    );
    return { service, model, recipientModel };
};

describe('DirectEmailSuppressionService opt-out', () => {
    it('preview resolves the token and returns the masked address without writing (AC-5)', async () => {
        // Arrange
        const { service, model } = buildService();

        // Act
        const result = await service.previewOptOut({ token: TOKEN });

        // Assert
        expect(result.data).toEqual({ maskedEmail: 'j***@example.com' });
        expect(model.insertIfAbsent).not.toHaveBeenCalled();
    });

    it('optOut suppresses the lowercased address of the token with reason opt_out and no admin', async () => {
        // Arrange
        const { service, model } = buildService();

        // Act
        const result = await service.optOut({ token: TOKEN });

        // Assert
        expect(result.data).toEqual({ maskedEmail: 'j***@example.com' });
        expect(model.insertIfAbsent).toHaveBeenCalledWith({
            email: 'juan@example.com',
            reason: 'opt_out',
            createdBy: null
        });
    });

    it('optOut is idempotent: a second visit succeeds too', async () => {
        const { service, model } = buildService();
        model.insertIfAbsent.mockResolvedValue({ suppression: { id: 's' }, created: false });
        const first = await service.optOut({ token: TOKEN });
        const second = await service.optOut({ token: TOKEN });
        expect(first.error).toBeUndefined();
        expect(second.error).toBeUndefined();
    });

    it('rejects an unknown token with a 400-class reason and writes nothing', async () => {
        const { service, model } = buildService();

        const result = await service.optOut({ token: 'x'.repeat(43) });

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.error?.reason).toBe('DIRECT_EMAIL_TOKEN_INVALID');
        expect(model.insertIfAbsent).not.toHaveBeenCalled();
    });

    it('rejects the fixed test-send token even if a row somehow carried it', async () => {
        const { service, model, recipientModel } = buildService({ test: 'a@b.com' });

        const preview = await service.previewOptOut({ token: 'test' });
        const optOut = await service.optOut({ token: 'test' });

        expect(preview.error?.reason).toBe('DIRECT_EMAIL_TOKEN_INVALID');
        expect(optOut.error?.reason).toBe('DIRECT_EMAIL_TOKEN_INVALID');
        expect(recipientModel.findByOptOutToken).not.toHaveBeenCalled();
        expect(model.insertIfAbsent).not.toHaveBeenCalled();
    });

    it('rejects an empty token', async () => {
        const { service } = buildService();
        const result = await service.previewOptOut({ token: '' });
        expect(result.error?.reason).toBe('DIRECT_EMAIL_TOKEN_INVALID');
    });
});

describe('DirectEmailSuppressionService admin operations', () => {
    it('list requires DIRECT_EMAIL_VIEW', async () => {
        const { service } = buildService();
        const denied = await service.list(buildActor([]), {});
        const allowed = await service.list(buildActor([PermissionEnum.DIRECT_EMAIL_VIEW]), {});
        expect(denied.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(allowed.data).toEqual({ items: [], total: 0 });
    });

    it('add records reason manual and the admin, lowercased', async () => {
        // Arrange
        const { service, model } = buildService();
        const actor = buildActor([PermissionEnum.DIRECT_EMAIL_SEND]);

        // Act
        const result = await service.add(actor, { email: 'X@Y.com' });

        // Assert
        expect(result.error).toBeUndefined();
        expect(model.insertIfAbsent).toHaveBeenCalledWith(
            { email: 'x@y.com', reason: 'manual', createdBy: actor.id },
            undefined
        );
    });

    it('add and remove require DIRECT_EMAIL_SEND', async () => {
        const { service, model } = buildService();
        const viewOnly = buildActor([PermissionEnum.DIRECT_EMAIL_VIEW]);
        const add = await service.add(viewOnly, { email: 'x@y.com' });
        const remove = await service.remove(viewOnly, {
            id: '22222222-2222-4222-8222-222222222222'
        });
        expect(add.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(remove.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(model.insertIfAbsent).not.toHaveBeenCalled();
        expect(model.hardDelete).not.toHaveBeenCalled();
    });

    it('remove answers NOT_FOUND when nothing was deleted', async () => {
        const { service, model } = buildService();
        model.hardDelete.mockResolvedValue(0);
        const result = await service.remove(buildActor([PermissionEnum.DIRECT_EMAIL_SEND]), {
            id: '22222222-2222-4222-8222-222222222222'
        });
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('addFromHardBounce suppresses with reason hard_bounce', async () => {
        const { service, model } = buildService();
        const result = await service.addFromHardBounce({ email: ' Bad@Example.com ' });
        expect(result).toEqual({ created: true });
        expect(model.insertIfAbsent).toHaveBeenCalledWith({
            email: 'bad@example.com',
            reason: 'hard_bounce',
            createdBy: null
        });
    });
});

describe('DirectEmailSuppressionService.remove opt-out lock', () => {
    const actor = buildActor([PermissionEnum.DIRECT_EMAIL_SEND]);
    const input = { id: '22222222-2222-4222-8222-222222222222' };

    it('refuses to delete an opt_out row with 409 and the locked reason', async () => {
        const { service, model } = buildService();
        model.findOne.mockResolvedValue({ id: input.id, reason: 'opt_out' });

        const result = await service.remove(actor, input);

        expect(result.error?.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
        expect(result.error?.reason).toBe('DIRECT_EMAIL_SUPPRESSION_OPT_OUT_LOCKED');
        expect(model.hardDelete).not.toHaveBeenCalled();
    });

    it.each(['manual', 'hard_bounce'])('deletes a %s row', async (reason) => {
        const { service, model } = buildService();
        model.findOne.mockResolvedValue({ id: input.id, reason });

        const result = await service.remove(actor, input);

        expect(result.data).toEqual({ id: input.id });
        expect(model.hardDelete).toHaveBeenCalledTimes(1);
    });
});
