/**
 * TEST:V8a:14 (HOS-1494, AC:V8a:12) — the service of action 24 over a partner
 * application made without an account, with `@repo/db` mocked: step 3 runs
 * before any read, everything that decides is read inside the transaction after
 * the application lock, a refusal writes nothing, and billing is never asked.
 */
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    calls: [] as string[],
    lockApplication: vi.fn(),
    findById: vi.fn(),
    findLiveAccountIdByEmail: vi.fn(),
    replaceApplicationEmail: vi.fn(),
    insert: vi.fn(),
    subjectPermissions: new Set<string>()
}));

vi.mock('@repo/db', () => ({
    getDb: () => ({
        transaction: async (work: (tx: unknown) => Promise<unknown>) => {
            mocks.calls.push('transaction');
            return work({ tx: true });
        }
    }),
    isPseudonymizedEmail: (input: { readonly email: string }) =>
        input.email.toLowerCase().endsWith('@pseudonym.invalid'),
    accountClosureModel: {
        lockApplication: (...args: unknown[]) => {
            mocks.calls.push('lockApplication');
            return mocks.lockApplication(...args);
        },
        findLiveAccountIdByEmail: (...args: unknown[]) => {
            mocks.calls.push('findLiveAccountIdByEmail');
            return mocks.findLiveAccountIdByEmail(...args);
        },
        replaceApplicationEmail: (...args: unknown[]) => {
            mocks.calls.push('replaceApplicationEmail');
            return mocks.replaceApplicationEmail(...args);
        }
    },
    userModel: {
        findById: (...args: unknown[]) => {
            mocks.calls.push('actorRow');
            return mocks.findById(...args);
        }
    },
    domainEventModel: {
        insert: (...args: unknown[]) => {
            mocks.calls.push('insert');
            return mocks.insert(...args);
        }
    }
}));
vi.mock('../../../src/utils/clock', () => ({
    getClock: () => ({ clock: { now: () => new Date('2026-10-12T12:00:00.000Z') } })
}));
vi.mock('../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => {
        throw new Error('action 24 over an application never asks billing');
    }
}));
vi.mock('../../../src/middlewares/actor', () => ({ resolveEffectivePermissions: vi.fn() }));
vi.mock(
    '../../../src/services/account-closure/account-closure-subject-permissions',
    async (importOriginal) => ({
        ...(await importOriginal<
            typeof import('../../../src/services/account-closure/account-closure-subject-permissions')
        >()),
        readSubjectEffectivePermissions: async () => {
            mocks.calls.push('subjectPermissions');
            return { permissions: mocks.subjectPermissions };
        }
    })
);
vi.mock('../../../src/utils/logger', () => ({ apiLogger: { info: vi.fn(), warn: vi.fn() } }));

import { ApplicationEmailReplacementService } from '../../../src/services/account-closure/application-email-replacement.service';

const APPLICATION = '33333333-3333-4333-8333-333333333333';
const ADMIN = '22222222-2222-4222-8222-222222222222';
const REASON = 'Ana asked support to delete her mailbox';
const support = {
    id: ADMIN,
    roles: [],
    permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.USER_CLOSE_ON_REQUEST]
} as unknown as Actor;

const service = () => new ApplicationEmailReplacementService();

async function replaceError(actor: Actor, reason = REASON) {
    try {
        await service().replaceApplicationEmailOnRequest({
            actor,
            applicationId: APPLICATION,
            reason
        });
        return undefined;
    } catch (error) {
        return error as { readonly code?: string; readonly reason?: string };
    }
}

beforeEach(() => {
    mocks.calls.length = 0;
    mocks.subjectPermissions = new Set<string>();
    vi.clearAllMocks();
    mocks.lockApplication.mockResolvedValue({
        id: APPLICATION,
        email: 'Ana@Example.com',
        status: 'PENDING',
        createdAt: new Date('2026-10-01T09:00:00.000Z')
    });
    mocks.findById.mockResolvedValue({ id: ADMIN, email: 'support@hospeda.test' });
    mocks.findLiveAccountIdByEmail.mockResolvedValue(null);
    mocks.replaceApplicationEmail.mockResolvedValue({ replaced: true });
});

describe('TEST:V8a:14 action 24 over an application made without an account (service)', () => {
    it('previews which application the mailbox belongs to, inside one transaction', async () => {
        // Act
        const preview = await service().previewApplication({
            actor: support,
            applicationId: APPLICATION
        });

        // Assert
        expect(preview).toEqual({
            applicationId: APPLICATION,
            email: 'Ana@Example.com',
            status: 'PENDING',
            createdAt: '2026-10-01T09:00:00.000Z'
        });
        expect(mocks.calls).toEqual([
            'transaction',
            'lockApplication',
            'actorRow',
            'findLiveAccountIdByEmail'
        ]);
    });

    it('replaces the mailbox and writes an event with only the field name, never asking billing', async () => {
        // Act
        const result = await service().replaceApplicationEmailOnRequest({
            actor: support,
            applicationId: APPLICATION,
            reason: `  ${REASON}  `
        });

        // Assert
        expect(result).toEqual({ replaced: true });
        expect(mocks.calls).toEqual([
            'transaction',
            'lockApplication',
            'actorRow',
            'findLiveAccountIdByEmail',
            'replaceApplicationEmail',
            'insert'
        ]);
        expect(mocks.insert).toHaveBeenCalledWith(
            expect.objectContaining({
                eventType: 'partner_application.email_replaced',
                entityType: 'partner_application',
                entityId: APPLICATION,
                actorType: 'admin',
                actorId: ADMIN,
                reason: REASON,
                changes: [{ field: 'email' }]
            })
        );
        expect(JSON.stringify(mocks.insert.mock.calls)).not.toContain('Ana@Example.com');
    });

    it.each([
        [
            'without its own permission (USER_DELETE + USER_HARD_DELETE)',
            {
                id: ADMIN,
                roles: [],
                permissions: [PermissionEnum.USER_DELETE, PermissionEnum.USER_HARD_DELETE]
            }
        ],
        ['as a system actor', { ...support, _isSystemActor: true }]
    ] as const)('step 3 refuses %s with FORBIDDEN before opening the transaction', async (_label, actor) => {
        // Act
        const error = await replaceError(actor as unknown as Actor);

        // Assert
        await expect(
            service().previewApplication({
                actor: actor as unknown as Actor,
                applicationId: APPLICATION
            })
        ).rejects.toMatchObject({ code: ServiceErrorCode.FORBIDDEN });
        expect(error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(mocks.calls).toEqual([]);
    });

    it('refuses a blank reason before opening the transaction', async () => {
        const error = await replaceError(support, '   ');
        expect(error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(mocks.calls).toEqual([]);
    });

    it.each([
        ['a missing application', null],
        [
            'an application already replaced',
            {
                id: APPLICATION,
                email: `deleted-application-${APPLICATION}@pseudonym.invalid`,
                status: 'PENDING',
                createdAt: new Date('2026-10-01T09:00:00.000Z')
            }
        ]
    ])('answers 404 for %s and writes nothing', async (_label, row) => {
        mocks.lockApplication.mockResolvedValue(row);
        const error = await replaceError(support);
        expect(error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(mocks.calls).not.toContain('replaceApplicationEmail');
        expect(mocks.calls).not.toContain('insert');
    });

    it.each([
        ['whose mailbox is the application one, in another case', 'ana@example.COM'],
        ['without a user row (fails closed)', null]
    ])('answers 403 to an actor %s and writes nothing', async (_label, email) => {
        mocks.findById.mockResolvedValue(email === null ? null : { id: ADMIN, email });
        const error = await replaceError(support);
        expect(error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(mocks.calls).not.toContain('replaceApplicationEmail');
        expect(mocks.calls).not.toContain('insert');
    });

    it('answers 409 APPLICATION_HAS_ACCOUNT when a live account carries the mailbox', async () => {
        mocks.findLiveAccountIdByEmail.mockResolvedValue('44444444-4444-4444-8444-444444444444');
        const error = await replaceError(support);
        expect(error).toMatchObject({
            code: ServiceErrorCode.ALREADY_EXISTS,
            reason: 'APPLICATION_HAS_ACCOUNT'
        });
        expect(mocks.calls).toContain('subjectPermissions');
        expect(mocks.calls).not.toContain('replaceApplicationEmail');
        expect(mocks.calls).not.toContain('insert');
    });

    it('answers 403 SUBJECT_OUTRANKS_ACTOR when that live account holds a permission the actor lacks', async () => {
        mocks.findLiveAccountIdByEmail.mockResolvedValue('44444444-4444-4444-8444-444444444444');
        mocks.subjectPermissions = new Set([PermissionEnum.USER_UPDATE_ROLES]);
        const error = await replaceError(support);
        await expect(
            service().previewApplication({ actor: support, applicationId: APPLICATION })
        ).rejects.toMatchObject({ code: ServiceErrorCode.FORBIDDEN });
        expect(error).toMatchObject({
            code: ServiceErrorCode.FORBIDDEN,
            reason: 'SUBJECT_OUTRANKS_ACTOR'
        });
        expect(mocks.calls).not.toContain('replaceApplicationEmail');
    });
});
