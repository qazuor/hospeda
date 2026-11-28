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
        upsertOptOut: vi.fn(async () => ({ id: 's', reason: 'opt_out' })),
        deleteUnlessOptOut: vi.fn(async () => 1),
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
        expect(model.upsertOptOut).toHaveBeenCalledWith({ email: 'juan@example.com' });
        expect(model.insertIfAbsent).not.toHaveBeenCalled();
    });

    it('optOut is idempotent: a second visit succeeds too', async () => {
        const { service } = buildService();
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
        expect(model.deleteUnlessOptOut).not.toHaveBeenCalled();
    });

    it('remove answers NOT_FOUND when nothing was deleted', async () => {
        const { service, model } = buildService();
        model.deleteUnlessOptOut.mockResolvedValue(0);
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

/**
 * In-memory model with the contract of the real one: one row per lower(email), `upsertOptOut`
 * upgrades any reason to opt_out, `insertIfAbsent` never changes an existing row, and
 * `deleteUnlessOptOut` deletes only non-opt_out rows.
 */
function buildStatefulModel() {
    const rows = new Map<string, { id: string; email: string; reason: string }>();
    let seq = 0;
    return {
        rows,
        insertIfAbsent: vi.fn(async (input: { email: string; reason: string }) => {
            const key = input.email.toLowerCase();
            const existing = rows.get(key);
            if (existing) return { suppression: existing, created: false };
            const row = {
                id: `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`,
                email: key,
                reason: input.reason
            };
            rows.set(key, row);
            return { suppression: row, created: true };
        }),
        upsertOptOut: vi.fn(async (input: { email: string }) => {
            const key = input.email.toLowerCase();
            const row = rows.get(key) ?? {
                id: `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`,
                email: key,
                reason: 'opt_out'
            };
            row.reason = 'opt_out';
            rows.set(key, row);
            return row;
        }),
        deleteUnlessOptOut: vi.fn(async (id: string) => {
            for (const [key, row] of rows) {
                if (row.id === id && row.reason !== 'opt_out') {
                    rows.delete(key);
                    return 1;
                }
            }
            return 0;
        }),
        findOne: vi.fn(
            async ({ id }: { id: string }) =>
                [...rows.values()].find((row) => row.id === id) ?? null
        )
    };
}

describe('DirectEmailSuppressionService opt-out lock (owner decision)', () => {
    const actor = buildActor([PermissionEnum.DIRECT_EMAIL_SEND]);
    const unknownId = '22222222-2222-4222-8222-222222222222';

    const setup = (email: string) => {
        const model = buildStatefulModel();
        const recipientModel = { findByOptOutToken: vi.fn(async () => ({ email })) };
        const service = new DirectEmailSuppressionService(
            {},
            { model: model as never, recipientModel: recipientModel as never }
        );
        return { service, model };
    };

    it('manual -> opt-out -> remove answers 409 locked (the lock cannot be bypassed)', async () => {
        const { service, model } = setup('a@x.com');
        await service.add(actor, { email: 'a@x.com' });

        await service.optOut({ token: 'tok' });
        const id = [...model.rows.values()][0]?.id ?? '';
        const result = await service.remove(actor, { id });

        expect(model.rows.get('a@x.com')?.reason).toBe('opt_out');
        expect(result.error?.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
        expect(result.error?.reason).toBe('DIRECT_EMAIL_SUPPRESSION_OPT_OUT_LOCKED');
    });

    it('hard_bounce -> opt-out upgrades the reason to opt_out', async () => {
        const { service, model } = setup('b@x.com');
        await service.addFromHardBounce({ email: 'b@x.com' });
        expect(model.rows.get('b@x.com')?.reason).toBe('hard_bounce');

        await service.optOut({ token: 'tok' });

        expect(model.rows.get('b@x.com')?.reason).toBe('opt_out');
    });

    it('opt_out stays opt_out when a hard bounce arrives later', async () => {
        const { service, model } = setup('c@x.com');
        await service.optOut({ token: 'tok' });

        await service.addFromHardBounce({ email: 'c@x.com' });

        expect(model.rows.get('c@x.com')?.reason).toBe('opt_out');
    });

    it.each(['manual', 'hard_bounce'])('deletes a %s row', async (reason) => {
        const { service, model } = setup('d@x.com');
        model.rows.set('d@x.com', { id: unknownId, email: 'd@x.com', reason });

        const result = await service.remove(actor, { id: unknownId });

        expect(result.data).toEqual({ id: unknownId });
        expect(model.rows.size).toBe(0);
    });

    it('answers 404 for an unknown id', async () => {
        const { service } = setup('e@x.com');

        const result = await service.remove(actor, { id: unknownId });

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });
});
