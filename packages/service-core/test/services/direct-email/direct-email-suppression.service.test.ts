import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { DirectEmailSuppressionService } from '../../../src/services/direct-email/direct-email-suppression.service.js';
import { generateDirectEmailOptOutToken } from '../../../src/services/direct-email/direct-email-token.helpers.js';
import { generateUnsubscribeToken } from '../../../src/services/newsletter/newsletter-token.helpers.js';
import type { Actor } from '../../../src/types/index.js';

const SECRET = 'a'.repeat(32);

const buildActor = (permissions: PermissionEnum[]): Actor => ({
    id: '11111111-1111-4111-8111-111111111111',
    roles: [RoleEnum.ADMIN],
    permissions
});

const buildService = (hmacSecret = SECRET) => {
    const model = {
        findPage: vi.fn(async () => ({ items: [], total: 0 })),
        insertIfAbsent: vi.fn(async () => ({ suppression: { id: 's' }, created: true })),
        hardDelete: vi.fn(async () => 1),
        findSuppressedEmails: vi.fn()
    };
    const service = new DirectEmailSuppressionService({}, { hmacSecret, model: model as never });
    return { service, model };
};

describe('DirectEmailSuppressionService opt-out', () => {
    it('preview validates the token and returns the masked address without writing (AC-5)', async () => {
        // Arrange
        const { service, model } = buildService();
        const token = generateDirectEmailOptOutToken({ email: 'juan@example.com', secret: SECRET });

        // Act
        const result = await service.previewOptOut({ token });

        // Assert
        expect(result.data).toEqual({ maskedEmail: 'j***@example.com' });
        expect(model.insertIfAbsent).not.toHaveBeenCalled();
    });

    it('optOut writes the suppression with reason opt_out and no admin', async () => {
        // Arrange
        const { service, model } = buildService();
        const token = generateDirectEmailOptOutToken({ email: 'Juan@Example.com', secret: SECRET });

        // Act
        const result = await service.optOut({ token });

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
        const token = generateDirectEmailOptOutToken({ email: 'a@b.com', secret: SECRET });
        const first = await service.optOut({ token });
        const second = await service.optOut({ token });
        expect(first.error).toBeUndefined();
        expect(second.error).toBeUndefined();
    });

    it('rejects a forged token with a 400-class reason and writes nothing', async () => {
        // Arrange
        const { service, model } = buildService();
        const token = generateDirectEmailOptOutToken({ email: 'a@b.com', secret: 'b'.repeat(32) });

        // Act
        const result = await service.optOut({ token });

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.error?.reason).toBe('DIRECT_EMAIL_TOKEN_INVALID');
        expect(model.insertIfAbsent).not.toHaveBeenCalled();
    });

    it('rejects a newsletter unsubscribe token', async () => {
        const { service, model } = buildService();
        const token = generateUnsubscribeToken({
            subscriberId: '11111111-1111-1111-1111-111111111111',
            channel: 'email',
            secret: SECRET
        });
        const result = await service.optOut({ token });
        expect(result.error?.reason).toBe('DIRECT_EMAIL_TOKEN_INVALID');
        expect(model.insertIfAbsent).not.toHaveBeenCalled();
    });

    it('answers SERVICE_UNAVAILABLE without an HMAC secret', async () => {
        const { service } = buildService('');
        const result = await service.previewOptOut({ token: 'a.b' });
        expect(result.error?.code).toBe(ServiceErrorCode.SERVICE_UNAVAILABLE);
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
