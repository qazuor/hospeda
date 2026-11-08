import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    previewAddonVersionPublication,
    publishAddonVersion
} from '../../../../src/services/billing/addon-catalog/addon-version-publication.service.js';
import {
    ADDON_VERSION_PUBLICATION_REJECTIONS,
    addonVersionPublicationRejection,
    assertAddonVersionPublicationPermitted,
    mapAddonVersionPublicationWriteError,
    REJECTION_CODES
} from '../../../../src/services/billing/addon-catalog/addon-version-publication-authorization.js';
import type { Actor } from '../../../../src/types/index.js';

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock('@repo/db', () => ({
    addonInstances: {},
    addonProducts: {},
    and: vi.fn(),
    domainEventModel: { insert: vi.fn() },
    eq: vi.fn(),
    getDb,
    inArray: vi.fn(),
    sql: vi.fn()
}));

const actor = (permissions: PermissionEnum[], system = false): Actor => ({
    id: crypto.randomUUID(),
    roles: [],
    permissions,
    _isSystemActor: system
});

describe('ACC_20 authorization and write-error mapping', () => {
    it.each([
        [undefined, 'absent'],
        [actor([PermissionEnum.ACCESS_PANEL_ADMIN]), 'without permission'],
        [actor([PermissionEnum.BILLING_PUBLISH_ADDON_VERSION], true), 'system actor']
    ] as const)('rejects %s before any database read (%s)', async (candidate, _label) => {
        const ports = { addonPolicy: vi.fn() };
        expect(() => assertAddonVersionPublicationPermitted({ actor: candidate })).toThrowError(
            expect.objectContaining({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' })
        );
        await expect(
            previewAddonVersionPublication({ actor: candidate, input: {} }, ports)
        ).rejects.toMatchObject({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' });
        await expect(
            publishAddonVersion({ actor: candidate, input: {} }, ports)
        ).rejects.toMatchObject({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' });
        expect(getDb).toHaveBeenCalledTimes(0);
    });

    it('accepts exactly the dedicated permission', () => {
        expect(() =>
            assertAddonVersionPublicationPermitted({
                actor: actor([PermissionEnum.BILLING_PUBLISH_ADDON_VERSION])
            })
        ).not.toThrow();
    });

    it.each(
        ADDON_VERSION_PUBLICATION_REJECTIONS
    )('maps %s through its exhaustive code table', (reason) => {
        const rejection = addonVersionPublicationRejection({ reason, message: reason });
        expect(rejection.code).toBe(REJECTION_CODES[reason]);
        expect(rejection.code).toBeOneOf([
            ServiceErrorCode.FORBIDDEN,
            ServiceErrorCode.NOT_FOUND,
            ServiceErrorCode.ALREADY_EXISTS,
            ServiceErrorCode.VALIDATION_ERROR
        ]);
    });

    it.each([
        ['23503', 'fk_addon_product_version_addon', 'ADDON_VERSION_OF_ANOTHER_ADDON'],
        [
            '23514',
            'ck_addon_product_periodic_not_fixed_days',
            'ADDON_VERSION_INCOMPATIBLE_WITH_CHARGE_KIND'
        ]
    ] as const)('maps wrapped %s %s', (code, constraint, reason) => {
        const error = new Error('wrapped', {
            cause: Object.assign(new Error('postgres'), { code, constraint })
        });
        expect(() => mapAddonVersionPublicationWriteError({ error })).toThrowError(
            expect.objectContaining({ reason })
        );
    });

    it('rethrows an unrelated write error', () => {
        const error = new Error('unrelated');
        expect(() => mapAddonVersionPublicationWriteError({ error })).toThrow(error);
    });
});
