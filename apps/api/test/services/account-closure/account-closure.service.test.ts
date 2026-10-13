import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const calls: string[] = [];
    return {
        calls,
        lockKeys: [] as string[],
        lockAccount: vi.fn(),
        lockListingsNotPurged: vi.fn(),
        lockPartnerPresence: vi.fn(),
        closeAccount: vi.fn(),
        insert: vi.fn(),
        canCharge: vi.fn(),
        subjectPermissions: new Set<string>()
    };
});

vi.mock('@repo/db', () => ({
    ACCOUNT_CLOSURE_PERSONAL_FIELDS: ['email', 'displayName', 'contactInfo.mobilePhone'],
    getDb: () => ({
        transaction: async (work: (tx: unknown) => Promise<unknown>) => {
            mocks.calls.push('transaction');
            return work({ tx: true });
        }
    }),
    accountClosureModel: {
        lockAccount: (...args: unknown[]) => {
            mocks.calls.push('lockAccount');
            return mocks.lockAccount(...args);
        },
        lockListingsNotPurged: (...args: unknown[]) => {
            mocks.calls.push('lockListingsNotPurged');
            return mocks.lockListingsNotPurged(...args);
        },
        lockPartnerPresence: (...args: unknown[]) => {
            mocks.calls.push('lockPartnerPresence');
            return mocks.lockPartnerPresence(...args);
        },
        closeAccount: (...args: unknown[]) => {
            mocks.calls.push('closeAccount');
            return mocks.closeAccount(...args);
        }
    },
    listingPublicationModel: {
        lock: async (args: { readonly key: string }) => {
            mocks.calls.push('lock');
            mocks.lockKeys.push(args.key);
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
        throw new Error('the injected billing port must be used');
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

import { AccountClosureService } from '../../../src/services/account-closure/account-closure.service';

const JUAN = '11111111-1111-4111-8111-111111111111';
const ADMIN = '22222222-2222-4222-8222-222222222222';
const REASON = 'Juan asked support to close his account';
const support: Actor = {
    id: ADMIN,
    roles: [],
    permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.USER_CLOSE_ON_REQUEST]
} as Actor;

function service(): AccountClosureService {
    return new AccountClosureService({
        billing: {
            canCharge: async (args) => {
                mocks.calls.push('canCharge');
                return mocks.canCharge(args);
            }
        }
    });
}

function arrange(input: {
    readonly canCharge?: boolean;
    readonly listings?: number;
    readonly presence?: boolean;
}): void {
    mocks.lockAccount.mockResolvedValue({
        id: JUAN,
        email: 'juan@example.com',
        displayName: 'Juan',
        firstName: 'Juan',
        lastName: 'Pérez',
        deletedAt: null,
        isSystemAccount: false
    });
    mocks.lockListingsNotPurged.mockResolvedValue(
        Array.from({ length: input.listings ?? 0 }, (_, i) => ({
            vertical: 'accommodation',
            id: `listing-${i}`
        }))
    );
    mocks.lockPartnerPresence.mockResolvedValue(
        input.presence ? { partnerId: 'p1', hasContent: true } : null
    );
    mocks.canCharge.mockResolvedValue({ canCharge: input.canCharge ?? false });
    mocks.closeAccount.mockResolvedValue({
        replacedApplicationIds: ['app-1'],
        deletedAccounts: 2,
        deletedSessions: 2,
        deletedVerifications: 0
    });
    mocks.insert.mockResolvedValue({});
}

async function closeError(actor: Actor = support, userId = JUAN) {
    return service()
        .closeOnRequest({ actor, userId, reason: REASON })
        .then(
            () => undefined,
            (error: unknown) => error as { code?: string; reason?: string }
        );
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.calls.length = 0;
    mocks.lockKeys.length = 0;
    mocks.subjectPermissions = new Set<string>([PermissionEnum.ACCESS_PANEL_ADMIN]);
});

describe('TEST:V8a:12 the account closure decides in one transaction', () => {
    it.each([
        [true, 0, false, 'ACCOUNT_CAN_STILL_BE_CHARGED'],
        [false, 1, false, 'ACCOUNT_HAS_LISTINGS'],
        [false, 0, true, 'ACCOUNT_HAS_PARTNER_PRESENCE'],
        [true, 1, false, 'ACCOUNT_CAN_STILL_BE_CHARGED'],
        [true, 0, true, 'ACCOUNT_CAN_STILL_BE_CHARGED'],
        [false, 2, true, 'ACCOUNT_HAS_LISTINGS'],
        [true, 3, true, 'ACCOUNT_CAN_STILL_BE_CHARGED']
    ] as const)('canCharge=%s listings=%s presence=%s is refused with 409 %s and writes nothing', async (canCharge, listings, presence, expected) => {
        // Arrange
        arrange({ canCharge, listings, presence });

        // Act
        const error = await closeError();

        // Assert
        expect(error?.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
        expect(error?.reason).toBe(expected);
        expect(mocks.closeAccount).not.toHaveBeenCalled();
        expect(mocks.insert).not.toHaveBeenCalled();
    });

    it('with canCharge true neither closes the account nor writes the event', async () => {
        arrange({ canCharge: true });
        await closeError();
        expect(mocks.canCharge).toHaveBeenCalledWith({ userId: JUAN });
        expect(mocks.closeAccount).not.toHaveBeenCalled();
        expect(mocks.insert).not.toHaveBeenCalled();
    });

    it('locks, reads, asks billing and writes in exactly this order, inside the transaction', async () => {
        // Arrange
        arrange({});

        // Act
        const result = await service().closeOnRequest({
            actor: support,
            userId: JUAN,
            reason: `  ${REASON}  `
        });

        // Assert
        expect(result).toEqual({ closed: true });
        expect(mocks.calls).toEqual([
            'transaction',
            'lockAccount',
            'subjectPermissions',
            'lock',
            'lock',
            'lock',
            'lockListingsNotPurged',
            'lockPartnerPresence',
            'canCharge',
            'closeAccount',
            'insert',
            'insert'
        ]);
        expect(mocks.lockKeys).toEqual([
            `trial-start:${JUAN}:accommodation`,
            `trial-start:${JUAN}:gastronomy`,
            `trial-start:${JUAN}:experience`
        ]);
        expect(mocks.closeAccount).toHaveBeenCalledWith(
            expect.objectContaining({ userId: JUAN, actorId: ADMIN })
        );
        const [accountEvent, applicationEvent] = mocks.insert.mock.calls.map(([event]) => event);
        expect(accountEvent).toMatchObject({
            eventType: 'account.closed_on_request',
            entityType: 'user',
            entityId: JUAN,
            actorId: ADMIN,
            actorType: 'admin',
            reason: REASON
        });
        expect(accountEvent.changes).toEqual([
            { field: 'email' },
            { field: 'displayName' },
            { field: 'contactInfo.mobilePhone' },
            { field: 'accounts', new: 2 },
            { field: 'sessions', new: 2 }
        ]);
        expect(JSON.stringify(accountEvent)).not.toContain('juan@example.com');
        expect(applicationEvent).toMatchObject({
            eventType: 'partner_application.email_replaced',
            entityType: 'partner_application',
            entityId: 'app-1',
            correlationId: accountEvent.correlationId,
            changes: [{ field: 'email' }]
        });
    });

    it('the preview runs the same locked reads, writes nothing and reports ready', async () => {
        arrange({ listings: 2 });
        const preview = await service().preview({ actor: support, userId: JUAN });
        expect(preview).toEqual({
            userId: JUAN,
            displayName: 'Juan',
            email: 'juan@example.com',
            canCharge: false,
            listingsNotPurged: 2,
            partnerPresenceWithContent: false,
            ready: false
        });
        expect(mocks.calls).toEqual([
            'transaction',
            'lockAccount',
            'subjectPermissions',
            'lock',
            'lock',
            'lock',
            'lockListingsNotPurged',
            'lockPartnerPresence',
            'canCharge'
        ]);
    });

    it.each([
        [
            'without its own permission (USER_DELETE + USER_HARD_DELETE)',
            {
                id: ADMIN,
                roles: [],
                permissions: [PermissionEnum.USER_DELETE, PermissionEnum.USER_HARD_DELETE]
            },
            JUAN
        ],
        [
            'with only the permission of action 23',
            { id: ADMIN, roles: [], permissions: [PermissionEnum.LISTING_PURGE_ON_REQUEST] },
            JUAN
        ],
        ['as a system actor', { ...support, _isSystemActor: true }, JUAN],
        ['on its own account (actor = subject)', support, ADMIN]
    ] as const)('step 3 refuses %s with FORBIDDEN before opening the transaction', async (_label, actor, userId) => {
        arrange({});
        const error = await closeError(actor as unknown as Actor, userId);
        await expect(
            service().preview({ actor: actor as unknown as Actor, userId })
        ).rejects.toMatchObject({ code: ServiceErrorCode.FORBIDDEN });
        expect(error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(mocks.calls).toEqual([]);
    });

    it('answers 404 for a missing or already closed account and 403 for a system account', async () => {
        arrange({});
        mocks.lockAccount.mockResolvedValueOnce(null);
        expect((await closeError())?.code).toBe(ServiceErrorCode.NOT_FOUND);
        mocks.lockAccount.mockResolvedValueOnce({ id: JUAN, deletedAt: new Date() });
        expect((await closeError())?.code).toBe(ServiceErrorCode.NOT_FOUND);
        mocks.lockAccount.mockResolvedValueOnce({
            id: JUAN,
            deletedAt: null,
            isSystemAccount: true
        });
        expect((await closeError())?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(mocks.canCharge).not.toHaveBeenCalled();
        expect(mocks.closeAccount).not.toHaveBeenCalled();
    });

    it('refuses with 403 SUBJECT_OUTRANKS_ACTOR when the subject holds a permission the actor lacks', async () => {
        // Arrange: the subject (a SUPER_ADMIN, say) holds USER_UPDATE_ROLES; support does not
        arrange({});
        mocks.subjectPermissions = new Set<string>([
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.USER_UPDATE_ROLES
        ]);

        // Act
        const error = await closeError();

        // Assert
        expect(error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(error?.reason).toBe('SUBJECT_OUTRANKS_ACTOR');
        expect(mocks.calls).toEqual(['transaction', 'lockAccount', 'subjectPermissions']);
        await expect(service().preview({ actor: support, userId: JUAN })).rejects.toMatchObject({
            code: ServiceErrorCode.FORBIDDEN,
            reason: 'SUBJECT_OUTRANKS_ACTOR'
        });
        expect(mocks.closeAccount).not.toHaveBeenCalled();
        expect(mocks.insert).not.toHaveBeenCalled();
    });

    it('refuses a blank reason without opening the transaction', async () => {
        arrange({});
        await expect(
            service().closeOnRequest({ actor: support, userId: JUAN, reason: '   ' })
        ).rejects.toMatchObject({ code: ServiceErrorCode.VALIDATION_ERROR });
        expect(mocks.calls).toEqual([]);
    });
});
