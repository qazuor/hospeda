import { PermissionEnum } from '@repo/schemas';

/** The closed 25 administrative actions from NUCLEO/08 §3 and V5.md §3.3. */
export const ADMINISTRATIVE_ACTIONS = [
    'ACC_1',
    'ACC_2',
    'ACC_3',
    'ACC_4',
    'ACC_5',
    'ACC_6',
    'ACC_7',
    'ACC_8',
    'ACC_9',
    'ACC_10',
    'ACC_11',
    'ACC_12',
    'ACC_13',
    'ACC_14',
    'ACC_15',
    'ACC_17',
    'ACC_18',
    'ACC_19',
    'ACC_20',
    'ACC_21',
    'ACC_22',
    'ACC_23',
    'ACC_24',
    'ACC_25',
    'ACC_26'
] as const;

/** An action in the closed NUCLEO/08 §3 catalog, as required by V5.md §3.3. */
export type AdministrativeAction = (typeof ADMINISTRATIVE_ACTIONS)[number];

/** Current route permissions and future owning pieces for NUCLEO/08 §3 and V5.md §3.3. */
export const ADMINISTRATIVE_ACTION_PERMISSIONS: Readonly<
    Record<
        AdministrativeAction,
        {
            readonly permissions: readonly PermissionEnum[];
            readonly pendingOwnPermission: string | null;
        }
    >
> = {
    ACC_1: { permissions: [], pendingOwnPermission: 'B9b' },
    ACC_2: { permissions: [], pendingOwnPermission: 'B9a' },
    ACC_3: { permissions: [PermissionEnum.PARTNER_MANAGE], pendingOwnPermission: 'B5 (HOS-1541)' },
    ACC_4: { permissions: [], pendingOwnPermission: 'B7' },
    ACC_5: { permissions: [PermissionEnum.PARTNER_MANAGE], pendingOwnPermission: 'V7 (HOS-1484)' },
    ACC_6: { permissions: [PermissionEnum.PARTNER_MANAGE], pendingOwnPermission: 'V7 (HOS-1489)' },
    ACC_7: { permissions: [], pendingOwnPermission: 'B11' },
    ACC_8: { permissions: [], pendingOwnPermission: 'B8a' },
    ACC_9: { permissions: [], pendingOwnPermission: 'B8b' },
    ACC_10: { permissions: [], pendingOwnPermission: 'B8b' },
    ACC_11: { permissions: [], pendingOwnPermission: 'V4.3 (HOS-1445)' },
    ACC_12: {
        permissions: [
            PermissionEnum.ACCOMMODATION_MODERATION_CHANGE,
            PermissionEnum.GASTRONOMY_MODERATION_CHANGE,
            PermissionEnum.EXPERIENCE_MODERATION_CHANGE
        ],
        pendingOwnPermission: 'V6 (HOS-1475)'
    },
    ACC_13: { permissions: [], pendingOwnPermission: 'B6' },
    ACC_14: { permissions: [], pendingOwnPermission: 'B5 (HOS-1540)' },
    ACC_15: {
        permissions: [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT],
        pendingOwnPermission: null
    },
    ACC_17: { permissions: [], pendingOwnPermission: 'B12 (HOS-1612)' },
    ACC_18: {
        permissions: [PermissionEnum.MAINTENANCE_MODE_WRITE],
        pendingOwnPermission: 'V2.3 (HOS-1436)'
    },
    ACC_19: { permissions: [], pendingOwnPermission: 'B2 (HOS-1515)' },
    ACC_20: { permissions: [], pendingOwnPermission: 'B10 (HOS-1595)' },
    ACC_21: { permissions: [], pendingOwnPermission: 'B9b (HOS-1591)' },
    ACC_22: { permissions: [], pendingOwnPermission: 'V6.9 (HOS-1479)' },
    ACC_23: {
        permissions: [
            PermissionEnum.ACCOMMODATION_DELETE_ANY,
            PermissionEnum.ACCOMMODATION_HARD_DELETE,
            PermissionEnum.GASTRONOMY_DELETE,
            PermissionEnum.EXPERIENCE_DELETE
        ],
        pendingOwnPermission: 'V8a (HOS-1493)'
    },
    ACC_24: {
        permissions: [PermissionEnum.USER_DELETE, PermissionEnum.USER_HARD_DELETE],
        pendingOwnPermission: 'V8a (HOS-1494)'
    },
    ACC_25: {
        permissions: [PermissionEnum.PARTNER_MANAGE],
        pendingOwnPermission: 'V8b (HOS-1498)'
    },
    ACC_26: {
        permissions: [PermissionEnum.USER_UPDATE_ROLES],
        pendingOwnPermission: 'V5.6 (HOS-1460)'
    }
};

/** Union of current permissions guarding NUCLEO/08 §3 actions under V5.md §3.3. */
export const ADMINISTRATIVE_ACTION_PERMISSION_SET: ReadonlySet<PermissionEnum> = new Set(
    ADMINISTRATIVE_ACTIONS.flatMap(
        (action) => ADMINISTRATIVE_ACTION_PERMISSIONS[action].permissions
    )
);
