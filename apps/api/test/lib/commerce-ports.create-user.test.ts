/**
 * Unit tests for `createCommerceOwnerCreateUserPort` (HOS-296 G-4 / AC-4).
 *
 * The port used to call `auth.api.signUpEmail` with no prior lookup and then
 * overwrite `users.role`. When the lead's email already belonged to an account
 * Better Auth rejected the signup, the provisioning service turned that into an
 * `INTERNAL_ERROR`, and `approveAndProvision` threw before marking the lead
 * approved — leaving the lead pending with no recovery path (the admin cannot
 * edit a lead's email and no endpoint links a lead to an existing user).
 *
 * The port is now resolve-or-create. These tests pin both branches and the
 * orphan-cleanup path, because "a registered host adds their restaurant" is the
 * ordinary case: MercadoPago keys the payout account by email, so the commerce
 * hat has to land on the SAME account.
 *
 * @module test/lib/commerce-ports.create-user.test
 */

import { RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const grantRoleMock = vi.hoisted(() => vi.fn());
const signUpEmailMock = vi.hoisted(() => vi.fn());
const selectLimitMock = vi.hoisted(() => vi.fn());
const updateWhereMock = vi.hoisted(() => vi.fn());
const deleteWhereMock = vi.hoisted(() => vi.fn());

vi.mock('@repo/db', () => ({
    getDb: () => ({
        select: () => ({
            from: () => ({
                where: () => ({ limit: selectLimitMock })
            })
        }),
        update: () => ({
            set: () => ({ where: updateWhereMock })
        }),
        delete: () => ({ where: deleteWhereMock })
    }),
    users: { id: 'users.id', email: 'users.email', displayName: 'users.displayName' }
}));

// The port only uses `eq` as an opaque predicate builder; the real one requires
// genuine Drizzle column objects, which the table stub above is not.
vi.mock('drizzle-orm', () => ({ eq: (a: unknown, b: unknown) => ({ a, b }) }));

vi.mock('@repo/service-core', () => ({ grantRole: grantRoleMock }));

vi.mock('../../src/lib/auth', () => ({
    getAuth: () => ({ api: { signUpEmail: signUpEmailMock } })
}));

vi.mock('../../src/utils/notification-helper', () => ({
    sendNotification: vi.fn().mockResolvedValue(undefined)
}));

import { createCommerceOwnerCreateUserPort } from '../../src/lib/commerce-ports';

const LEAD_EMAIL = 'juan@example.com';
const EXISTING_USER_ID = 'user-already-registered';
const NEW_USER_ID = 'user-freshly-created';

const portInput = {
    email: LEAD_EMAIL,
    password: 'temp-password-abcdef123456',
    name: 'Juan Pérez',
    role: RoleEnum.COMMERCE_OWNER,
    mustChangePassword: true
} as const;

describe('createCommerceOwnerCreateUserPort', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        grantRoleMock.mockResolvedValue({ data: undefined });
        updateWhereMock.mockResolvedValue(undefined);
        deleteWhereMock.mockResolvedValue(undefined);
    });

    describe('the email already belongs to an account (AC-4)', () => {
        beforeEach(() => {
            selectLimitMock.mockResolvedValue([
                { id: EXISTING_USER_ID, email: LEAD_EMAIL, displayName: 'Juan Host' }
            ]);
        });

        it('grants the commerce hat instead of attempting a colliding signup', async () => {
            const port = createCommerceOwnerCreateUserPort(new Headers());

            const result = await port(portInput);

            // The duplicate-email INTERNAL_ERROR that used to strand the lead.
            expect(signUpEmailMock).not.toHaveBeenCalled();

            expect(grantRoleMock).toHaveBeenCalledTimes(1);
            expect(grantRoleMock).toHaveBeenCalledWith({
                userId: EXISTING_USER_ID,
                role: RoleEnum.COMMERCE_OWNER,
                grantedBy: null,
                reason: 'commerce_lead_approved'
            });

            expect(result).toEqual({
                id: EXISTING_USER_ID,
                email: LEAD_EMAIL,
                name: 'Juan Host',
                alreadyExisted: true
            });
        });

        it('never touches the existing account row', async () => {
            const port = createCommerceOwnerCreateUserPort(new Headers());

            await port(portInput);

            // No password reset, no `mustChangePassword` flip, no role column
            // write — the account keeps working exactly as it did.
            expect(updateWhereMock).not.toHaveBeenCalled();
            expect(deleteWhereMock).not.toHaveBeenCalled();
        });

        it('propagates a grant failure rather than reporting a linked account', async () => {
            grantRoleMock.mockResolvedValue({ error: { message: 'grant exploded' } });
            const port = createCommerceOwnerCreateUserPort(new Headers());

            await expect(port(portInput)).rejects.toThrow(/grant exploded/);
        });
    });

    describe('the email is free', () => {
        beforeEach(() => {
            selectLimitMock.mockResolvedValue([]);
            signUpEmailMock.mockResolvedValue({
                user: { id: NEW_USER_ID, email: LEAD_EMAIL, name: 'Juan Pérez' }
            });
        });

        it('creates the account, verifies it, and grants the hat', async () => {
            const port = createCommerceOwnerCreateUserPort(new Headers());

            const result = await port(portInput);

            expect(signUpEmailMock).toHaveBeenCalledTimes(1);
            expect(updateWhereMock).toHaveBeenCalledTimes(1);
            expect(grantRoleMock).toHaveBeenCalledWith({
                userId: NEW_USER_ID,
                role: RoleEnum.COMMERCE_OWNER,
                grantedBy: null,
                reason: 'commerce_lead_approved'
            });
            expect(result).toEqual({
                id: NEW_USER_ID,
                email: LEAD_EMAIL,
                name: 'Juan Pérez',
                alreadyExisted: false
            });
        });

        it('deletes the orphan account when the grant fails', async () => {
            grantRoleMock.mockResolvedValue({ error: { message: 'grant exploded' } });
            const port = createCommerceOwnerCreateUserPort(new Headers());

            await expect(port(portInput)).rejects.toThrow(/Failed to assign role/);

            // Otherwise the DB accumulates accounts that never got their hat and
            // whose email now blocks a retry of the same lead.
            expect(deleteWhereMock).toHaveBeenCalledTimes(1);
        });

        it('throws when Better Auth returns no user id', async () => {
            signUpEmailMock.mockResolvedValue({ user: undefined });
            const port = createCommerceOwnerCreateUserPort(new Headers());

            await expect(port(portInput)).rejects.toThrow(/Could not create the user account/);
            expect(grantRoleMock).not.toHaveBeenCalled();
        });
    });
});
