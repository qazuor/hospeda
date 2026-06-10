import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    checkCanHardDelete,
    checkCanRestore,
    checkCanSoftDelete,
    checkCanUpdate
} from '../../../src/services/accommodation/accommodation.permissions';
import { ServiceError } from '../../../src/types';
import { createMockAccommodation } from '../../factories/accommodationFactory';
import { getMockId } from '../../factories/utilsFactory';

const OWNER_ID = getMockId('user', 'host-owner');
const OTHER_ID = getMockId('user', 'other-owner');

/** HOST after SPEC-169: only `_OWN` write permissions, no `_ANY`, no HARD_DELETE. */
const hostActor = {
    id: OWNER_ID,
    role: RoleEnum.HOST,
    permissions: [
        PermissionEnum.ACCOMMODATION_UPDATE_OWN,
        PermissionEnum.ACCOMMODATION_DELETE_OWN,
        PermissionEnum.ACCOMMODATION_RESTORE_OWN
    ]
};

const ownAccommodation = createMockAccommodation({ ownerId: OWNER_ID });
const othersAccommodation = createMockAccommodation({ ownerId: OTHER_ID });

const expectForbidden = (fn: () => void) => {
    expect(fn).toThrow(ServiceError);
    try {
        fn();
    } catch (err) {
        expect((err as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
    }
};

describe('SPEC-169 AC-10/AC-11 — accommodation write ownership enforcement', () => {
    describe('an _OWN-only HOST acting on ANOTHER owner accommodation is DENIED', () => {
        it('update → FORBIDDEN', () => {
            expectForbidden(() => checkCanUpdate(hostActor, othersAccommodation));
        });
        it('softDelete → FORBIDDEN', () => {
            expectForbidden(() => checkCanSoftDelete(hostActor, othersAccommodation));
        });
        it('restore → FORBIDDEN', () => {
            expectForbidden(() => checkCanRestore(hostActor, othersAccommodation));
        });
        it('hardDelete → FORBIDDEN (no _OWN variant; staff-only)', () => {
            expectForbidden(() => checkCanHardDelete(hostActor, othersAccommodation));
        });
    });

    describe('an _OWN-only HOST acting on its OWN accommodation is ALLOWED (except hardDelete)', () => {
        it('update → allowed', () => {
            expect(() => checkCanUpdate(hostActor, ownAccommodation)).not.toThrow();
        });
        it('softDelete → allowed', () => {
            expect(() => checkCanSoftDelete(hostActor, ownAccommodation)).not.toThrow();
        });
        it('restore → allowed', () => {
            expect(() => checkCanRestore(hostActor, ownAccommodation)).not.toThrow();
        });
        it('hardDelete → FORBIDDEN even on own (staff-only, AC-11 matrix)', () => {
            expectForbidden(() => checkCanHardDelete(hostActor, ownAccommodation));
        });
    });

    describe('AC-11 ownership-enforcement matrix (accommodation)', () => {
        // Each owner-scoped write op uses checkGenericPermission(_ANY, _OWN, isOwner); hardDelete
        // is permission-only and staff-only. A staff actor with _ANY may act on any record.
        const staffActor = {
            id: getMockId('user', 'staff'),
            role: RoleEnum.ADMIN,
            permissions: [
                PermissionEnum.ACCOMMODATION_UPDATE_ANY,
                PermissionEnum.ACCOMMODATION_DELETE_ANY,
                PermissionEnum.ACCOMMODATION_RESTORE_ANY,
                PermissionEnum.ACCOMMODATION_HARD_DELETE
            ]
        };

        it('staff with _ANY may update/softDelete/restore/hardDelete ANY accommodation', () => {
            expect(() => checkCanUpdate(staffActor, othersAccommodation)).not.toThrow();
            expect(() => checkCanSoftDelete(staffActor, othersAccommodation)).not.toThrow();
            expect(() => checkCanRestore(staffActor, othersAccommodation)).not.toThrow();
            expect(() => checkCanHardDelete(staffActor, othersAccommodation)).not.toThrow();
        });
    });
});
